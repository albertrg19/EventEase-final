-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 31, 2025 at 11:51 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `coliseum_booking_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `event_name` varchar(255) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `event_category_id` int(11) NOT NULL,
  `hall_id` int(11) NOT NULL,
  `event_date` date NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `admin_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `customer_id`, `user_id`, `event_name`, `event_type`, `event_category_id`, `hall_id`, `event_date`, `status`, `created_at`, `admin_notes`) VALUES
(9, 4, 4, 'Kasalan', 'da', 2, 1, '2025-03-04', 'approved', '2025-03-26 06:12:40', ''),
(10, 4, 4, 'basket', 'sports', 4, 1, '2025-03-05', 'approved', '2025-03-26 06:33:37', ''),
(11, 4, 4, 'basket', 'sports', 4, 1, '2025-03-05', 'rejected', '2025-03-26 06:33:37', 'tite'),
(12, 6, 6, 'boxing', 'suntukan', 3, 2, '2025-03-13', 'approved', '2025-03-26 15:07:57', ''),
(15, 6, 6, 'indoor games', 'school', 4, 2, '2025-03-14', 'approved', '2025-03-26 22:43:56', ''),
(16, 6, 6, 'boxing', 'school', 4, 1, '2025-03-15', 'rejected', '2025-03-27 02:50:08', 'tanginamo'),
(17, 6, 6, 'graduation', 'school event', 5, 1, '2025-03-17', 'approved', '2025-03-27 04:29:31', ''),
(18, 6, 6, 'CPSU Graduation', 'school graduation', 5, 1, '2025-03-29', 'approved', '2025-03-28 01:20:02', ''),
(19, 7, 7, 'mariel\'s best day', 'wedding', 1, 3, '2025-03-31', 'approved', '2025-03-28 05:52:59', 'himo a ko maninay'),
(20, 7, 7, 'kyle and rhein ', 'wedding', 1, 1, '2025-03-18', 'rejected', '2025-03-28 06:00:02', 'nalagyo si rhein'),
(21, 6, 6, 'boxing', 'wedding', 1, 2, '2025-03-18', 'pending', '2025-03-29 08:34:53', NULL),
(22, 6, 6, 'music workshop', 'workshop', 3, 2, '2025-04-05', 'approved', '2025-03-31 06:10:00', ''),
(23, 6, 6, 'CPSU graduation ', 'School event', 5, 1, '2025-04-11', 'pending', '2025-04-02 06:46:27', NULL),
(24, 9, 9, 'Bsnsn', 'Wedding ni joselle', 1, 1, '2025-04-08', 'approved', '2025-04-02 06:55:11', ''),
(25, 9, 9, 'CPSU boxing BSIT VS BEED', 'School event', 4, 1, '2025-04-17', 'rejected', '2025-04-02 06:59:07', 'ayaw namin ng palaaway'),
(26, 6, 6, 'graduation', 'school graduation', 5, 1, '2025-04-14', 'approved', '2025-04-06 13:12:33', ''),
(27, 10, 10, 'dota tournament', 'esport', 4, 1, '2025-09-01', 'approved', '2025-08-28 07:59:31', '');

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `hall_id` int(11) NOT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`id`, `title`, `hall_id`, `start_date`, `end_date`, `description`, `created_at`) VALUES
(1, 'Conference Hall Meeting', 1, '2025-08-30 10:00:00', '2025-08-30 16:00:00', 'Business conference', '2025-08-28 06:12:29'),
(2, 'Wedding Reception', 2, '2025-09-01 18:00:00', '2025-09-01 23:00:00', 'Wedding celebration', '2025-08-28 06:12:29'),
(3, 'Corporate Training', 1, '2025-09-05 09:00:00', '2025-09-05 17:00:00', 'Staff training session', '2025-08-28 06:12:29');

-- --------------------------------------------------------

--
-- Table structure for table `event_categories`
--

CREATE TABLE `event_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `image` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_categories`
--

INSERT INTO `event_categories` (`id`, `name`, `description`, `created_at`, `image`) VALUES
(1, 'Wedding', 'Make your dream wedding a reality with our seamless event reservation services.', '2025-03-26 02:37:00', '1742959859_229799.jpg'),
(2, 'Birthday', 'Book your perfect birthday venue easy and unforgettable!', '2025-03-26 03:39:24', '1742960364_maxresdefault.jpg'),
(3, 'Corporate Gathering', 'Host a seamless corporate gathering with the perfect venue for meetings.', '2025-03-26 03:40:24', '1742960424_image-asset.jpeg'),
(4, 'Sports', 'Game on! Reserve your sports venue today.', '2025-03-26 03:41:39', '1742960499_10nba-taiwan-top-mobileMasterAt3x-v2.jpg'),
(5, 'School Graduation', 'Host a memorable school graduation with ease.', '2025-03-26 03:43:28', '1742960608_graduate.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `event_halls`
--

CREATE TABLE `event_halls` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` text NOT NULL,
  `capacity` int(11) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `max_capacity` int(10) NOT NULL DEFAULT 0,
  `photo` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_halls`
--

INSERT INTO `event_halls` (`id`, `name`, `location`, `capacity`, `description`, `created_at`, `price`, `max_capacity`, `photo`) VALUES
(1, 'Court', 'court', 0, '', '2025-03-26 02:40:56', 15000.00, 7000, '02-16-Victorias-City-Coliseum.jpeg'),
(2, 'Lobby', 'Lobby', 0, '', '2025-03-26 09:56:54', 2500.00, 100, 'photo_2025-02-27_19-01-43 (5).jpg'),
(3, 'VIP', 'VIP Room', 0, '', '2025-03-26 09:58:21', 1200.00, 4, 'photo_2025-02-27_19-01-41.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `homepage_content`
--

CREATE TABLE `homepage_content` (
  `id` int(11) NOT NULL,
  `section` varchar(50) NOT NULL,
  `content` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `base_price` decimal(10,2) NOT NULL,
  `additional_fees` decimal(10,2) DEFAULT 0.00,
  `discount` decimal(10,2) DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `invoices`
--

INSERT INTO `invoices` (`id`, `booking_id`, `base_price`, `additional_fees`, `discount`, `total_amount`, `created_at`) VALUES
(1, 9, 2000.00, 0.00, 0.00, 2000.00, '2025-03-26 06:25:16'),
(2, 10, 2000.00, 0.00, 0.00, 2000.00, '2025-03-26 07:45:22'),
(3, 12, 350.00, 0.00, 0.00, 350.00, '2025-03-26 15:27:55'),
(4, 15, 350.00, 0.00, 0.00, 350.00, '2025-03-26 22:45:01'),
(5, 17, 2000.00, 0.00, 0.00, 2000.00, '2025-03-27 04:30:25'),
(6, 19, 500.00, 0.00, 300.00, 200.00, '2025-03-28 05:55:42'),
(7, 22, 350.00, 0.00, 0.00, 350.00, '2025-03-31 06:22:24'),
(8, 18, 2000.00, 0.00, 0.00, 2000.00, '2025-03-31 06:22:32'),
(9, 24, 15000.00, 0.00, 0.00, 15000.00, '2025-04-02 06:55:44'),
(10, 26, 15000.00, 0.00, 0.00, 15000.00, '2025-04-06 13:15:09'),
(11, 27, 15000.00, 0.00, 0.00, 15000.00, '2025-08-28 08:02:46');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','customer') DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `phone`, `password`, `role`, `created_at`) VALUES
(1, 'admin', 'admin@pwd.gov', NULL, '$2y$10$jvT9DEUgNormyjHhju11KekB3vV4z5wHOsVmA70RTrvd035GlJiVC', 'customer', '2025-03-26 02:49:34'),
(2, 'admin', 'admin@admin.com', NULL, '$2y$10$wr/mGRZjtTCWbv706qOdWuboDjV.7.pKp1hk14r.TcCssf7/YwWNq', 'admin', '2025-03-26 02:50:06'),
(3, 'Ricky', 'a@a.com', NULL, '$2y$10$LzPAjltRh26.XMfBAF9VkuRO3Qsqyu0Ao9tVPOkGC91t1Z7q9eNJ.', 'customer', '2025-03-26 03:00:08'),
(4, 'Ricky', 'ricky@ricky.com', NULL, '$2y$10$mZsD0rDO01yLmlG0s5dAGerP5svkE1te/2SCw106ZEYFeAO7HoOOi', 'customer', '2025-03-26 04:41:42'),
(5, 'Jerry waest', 'j@j.com', NULL, '$2y$10$X2Yrq1vER2t2GVPh2yHWEOL7sVUT5eETuHE7fjrKaFW84FekVoeOC', 'customer', '2025-03-26 05:10:21'),
(6, 'Albert Fernandez', 'crazybert9@gmail.com', NULL, '$2y$10$..ccSEQAgTyDisKI7hVe..K/hvPeUN9uZZNQMIziKnDy6sMVPkpP2', 'customer', '2025-03-26 07:52:28'),
(7, 'mariel', 'mariel@gmail.com', NULL, '$2y$10$DrZhhIPi76k553BHiANJ5u1ESm468nIxyism.fTfKI8KRJVL9/6CO', 'customer', '2025-03-28 05:51:33'),
(8, 'Rica Alorro', 'ricaa@gmail.com', NULL, '$2y$10$qQ4TEfKPQwgiWG5GNBj0NOzNR67jhY1SuIxRnYmuzo1e1G3bXjB/u', 'customer', '2025-03-31 03:31:16'),
(9, 'Joselle Parreno', 'joselle@gmail.com', NULL, '$2y$10$tSOQ0Cv5Bla9G1Cr7Jafv.KbPQg/RHYtfg1KMkBBBq8rdCO/M76KK', 'customer', '2025-04-02 06:42:54'),
(10, 'carlo eawan', 'carlo@gwapo.com', '09123456782', '$2y$10$OHxuz6eL7j7MOn5YXkcjTOW87ZgG9J7Y.fh0D6DJTvMcxw2Ip2Yp6', 'customer', '2025-08-28 07:57:31');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `fk_bookings_event_category` (`event_category_id`),
  ADD KEY `fk_bookings_hall` (`hall_id`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `hall_id` (`hall_id`);

--
-- Indexes for table `event_categories`
--
ALTER TABLE `event_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `event_halls`
--
ALTER TABLE `event_halls`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `homepage_content`
--
ALTER TABLE `homepage_content`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `booking_id` (`booking_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `event_categories`
--
ALTER TABLE `event_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `event_halls`
--
ALTER TABLE `event_halls`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `homepage_content`
--
ALTER TABLE `homepage_content`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bookings_event_category` FOREIGN KEY (`event_category_id`) REFERENCES `event_categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bookings_hall` FOREIGN KEY (`hall_id`) REFERENCES `event_halls` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`hall_id`) REFERENCES `event_halls` (`id`);

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `fk_invoice_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
