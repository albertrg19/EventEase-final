package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler { return &UploadHandler{} }

// Image handles multipart image uploads and returns a public URL
func (h *UploadHandler) Image(c *gin.Context) {
	// Limit request body to ~10MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 10<<20)

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}

	// Ensure uploads directory exists
	dir := "./uploads"
	if err := os.MkdirAll(dir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare storage"})
		return
	}

	filename := fmt.Sprintf("img_%d%s", time.Now().UnixNano(), ext)
	path := filepath.Join(dir, filename)
	if err := c.SaveUploadedFile(file, path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	// Public URL (served by r.Static in main.go)
	publicURL := "/uploads/" + filename
	c.JSON(http.StatusCreated, gin.H{"url": publicURL})
}

// ChatFile handles multipart file uploads for chat (supports images and documents)
func (h *UploadHandler) ChatFile(c *gin.Context) {
	// Limit request body to ~15MB (slightly higher than 10MB to account for multipart overhead)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 15<<20)

	file, err := c.FormFile("file")
	if err != nil {
		fmt.Printf("[ChatFile] Error getting file: %v\n", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	
	fmt.Printf("[ChatFile] Received file upload: %s, size: %d, type: %s\n", file.Filename, file.Size, file.Header.Get("Content-Type"))

	ext := strings.ToLower(filepath.Ext(file.Filename))
	// Allow images and common document types
	allowedExts := []string{".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx", ".txt"}
	allowed := false
	for _, allowedExt := range allowedExts {
		if ext == allowedExt {
			allowed = true
			break
		}
	}

	if !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported file type: %s. Allowed types: images, PDF, DOC, DOCX, TXT", ext)})
		return
	}

	// Ensure uploads directory exists
	dir := "./uploads"
	if err := os.MkdirAll(dir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare storage"})
		return
	}

	// Use different prefix for chat files
	prefix := "img_"
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		prefix = "file_"
	}
	
	filename := fmt.Sprintf("%s%d%s", prefix, time.Now().UnixNano(), ext)
	path := filepath.Join(dir, filename)
	if err := c.SaveUploadedFile(file, path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	// Public URL (served by r.Static in main.go)
	publicURL := "/uploads/" + filename
	c.JSON(http.StatusCreated, gin.H{"url": publicURL})
}