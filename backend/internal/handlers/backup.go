package handlers

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BackupHandler struct {
	db         *gorm.DB
	backupDir  string
	maxBackups int
	mu         sync.Mutex
	scheduler  *time.Ticker
	stopChan   chan struct{}
}

type BackupInfo struct {
	Filename  string    `json:"filename"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}

func NewBackupHandler(db *gorm.DB) *BackupHandler {
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "./backups"
	}

	// Create backup directory if it doesn't exist
	os.MkdirAll(backupDir, 0755)

	maxBackups := 10 // Keep last 10 backups

	return &BackupHandler{
		db:         db,
		backupDir:  backupDir,
		maxBackups: maxBackups,
		stopChan:   make(chan struct{}),
	}
}

// StartScheduler starts the automatic backup scheduler
func (h *BackupHandler) StartScheduler(interval time.Duration) {
	h.scheduler = time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-h.scheduler.C:
				h.performBackup()
			case <-h.stopChan:
				h.scheduler.Stop()
				return
			}
		}
	}()
	fmt.Printf("Backup scheduler started with interval: %v\n", interval)
}

// StopScheduler stops the automatic backup scheduler
func (h *BackupHandler) StopScheduler() {
	close(h.stopChan)
}

// performBackup creates a database backup
func (h *BackupHandler) performBackup() (*BackupInfo, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("backup_%s.sql", timestamp)
	filepath := filepath.Join(h.backupDir, filename)

	// Get database connection info
	sqlDB, err := h.db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database connection: %w", err)
	}

	// Get database name from connection
	var dbName string
	err = sqlDB.QueryRow("SELECT DATABASE()").Scan(&dbName)
	if err != nil {
		return nil, fmt.Errorf("failed to get database name: %w", err)
	}

	// Database credentials from environment
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "3306"
	}
	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "root"
	}
	dbPass := os.Getenv("DB_PASSWORD")

	// Try mysqldump first
	args := []string{
		"-h", dbHost,
		"-P", dbPort,
		"-u", dbUser,
		"--single-transaction",
		"--routines",
		"--triggers",
		"--result-file=" + filepath,
	}
	if dbPass != "" {
		args = append(args, "-p"+dbPass)
	}
	args = append(args, dbName)

	cmd := exec.Command("mysqldump", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// If mysqldump fails, try SQLite backup as fallback
		sqliteFile := os.Getenv("SQLITE_FILE")
		if sqliteFile != "" {
			// Copy SQLite file
			input, err := os.ReadFile(sqliteFile)
			if err != nil {
				return nil, fmt.Errorf("backup failed: %s, output: %s", err, string(output))
			}
			err = os.WriteFile(filepath, input, 0644)
			if err != nil {
				return nil, fmt.Errorf("failed to write backup: %w", err)
			}
		} else {
			// Create a simple SQL dump using GORM
			err = h.createSimpleBackup(filepath)
			if err != nil {
				return nil, fmt.Errorf("backup failed: %w", err)
			}
		}
	}

	// Get file info
	fileInfo, err := os.Stat(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to get backup info: %w", err)
	}

	info := &BackupInfo{
		Filename:  filename,
		Size:      fileInfo.Size(),
		CreatedAt: time.Now(),
	}

	// Clean up old backups
	h.cleanupOldBackups()

	return info, nil
}

// createSimpleBackup creates a basic SQL dump
func (h *BackupHandler) createSimpleBackup(filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Write header
	file.WriteString("-- EventEase Database Backup\n")
	file.WriteString(fmt.Sprintf("-- Created: %s\n\n", time.Now().Format(time.RFC3339)))

	// Get table names
	tables := []string{"users", "event_categories", "event_halls", "events", "bookings", "invoices", "admin_activities", "homepage_contents"}

	for _, table := range tables {
		file.WriteString(fmt.Sprintf("-- Table: %s\n", table))
		
		// Get table data
		rows, err := h.db.Raw(fmt.Sprintf("SELECT * FROM %s", table)).Rows()
		if err != nil {
			continue
		}
		defer rows.Close()

		columns, err := rows.Columns()
		if err != nil {
			continue
		}

		for rows.Next() {
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range values {
				valuePtrs[i] = &values[i]
			}

			if err := rows.Scan(valuePtrs...); err != nil {
				continue
			}

			var valueStrings []string
			for _, v := range values {
				switch val := v.(type) {
				case nil:
					valueStrings = append(valueStrings, "NULL")
				case []byte:
					valueStrings = append(valueStrings, fmt.Sprintf("'%s'", strings.ReplaceAll(string(val), "'", "''")))
				case string:
					valueStrings = append(valueStrings, fmt.Sprintf("'%s'", strings.ReplaceAll(val, "'", "''")))
				case time.Time:
					valueStrings = append(valueStrings, fmt.Sprintf("'%s'", val.Format("2006-01-02 15:04:05")))
				default:
					valueStrings = append(valueStrings, fmt.Sprintf("%v", val))
				}
			}

			file.WriteString(fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s);\n",
				table,
				strings.Join(columns, ", "),
				strings.Join(valueStrings, ", "),
			))
		}
		file.WriteString("\n")
	}

	return nil
}

// cleanupOldBackups removes old backup files
func (h *BackupHandler) cleanupOldBackups() {
	files, err := os.ReadDir(h.backupDir)
	if err != nil {
		return
	}

	var backups []os.DirEntry
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), "backup_") && strings.HasSuffix(f.Name(), ".sql") {
			backups = append(backups, f)
		}
	}

	if len(backups) <= h.maxBackups {
		return
	}

	// Sort by name (which includes timestamp)
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].Name() < backups[j].Name()
	})

	// Remove oldest backups
	for i := 0; i < len(backups)-h.maxBackups; i++ {
		os.Remove(filepath.Join(h.backupDir, backups[i].Name()))
	}
}

// CreateBackup handles manual backup creation
func (h *BackupHandler) CreateBackup(c *gin.Context) {
	info, err := h.performBackup()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Backup created successfully",
		"backup":  info,
	})
}

// ListBackups returns list of available backups
func (h *BackupHandler) ListBackups(c *gin.Context) {
	files, err := os.ReadDir(h.backupDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list backups"})
		return
	}

	var backups []BackupInfo
	for _, f := range files {
		if !f.IsDir() && strings.HasPrefix(f.Name(), "backup_") {
			info, err := f.Info()
			if err != nil {
				continue
			}
			backups = append(backups, BackupInfo{
				Filename:  f.Name(),
				Size:      info.Size(),
				CreatedAt: info.ModTime(),
			})
		}
	}

	// Sort by date descending
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	c.JSON(http.StatusOK, backups)
}

// DownloadBackup serves a backup file for download
func (h *BackupHandler) DownloadBackup(c *gin.Context) {
	filename := c.Param("filename")
	
	// Security: only allow backup files
	if !strings.HasPrefix(filename, "backup_") || !strings.HasSuffix(filename, ".sql") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup filename"})
		return
	}

	filepath := filepath.Join(h.backupDir, filename)
	if _, err := os.Stat(filepath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "backup not found"})
		return
	}

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "application/octet-stream")
	c.File(filepath)
}

// DeleteBackup removes a backup file
func (h *BackupHandler) DeleteBackup(c *gin.Context) {
	filename := c.Param("filename")
	
	// Security: only allow backup files
	if !strings.HasPrefix(filename, "backup_") || !strings.HasSuffix(filename, ".sql") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid backup filename"})
		return
	}

	filepath := filepath.Join(h.backupDir, filename)
	if err := os.Remove(filepath); err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "backup not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete backup"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup deleted successfully"})
}

