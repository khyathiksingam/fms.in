-- 002_seed_baseline_data.sql
-- Seed baseline metadata non-destructively

-- 1. Baseline Roles
INSERT INTO roles (id, name) SELECT 1, 'admin' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE id = 1);
INSERT INTO roles (id, name) SELECT 2, 'hod' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE id = 2);
INSERT INTO roles (id, name) SELECT 3, 'faculty' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE id = 3);
INSERT INTO roles (id, name) SELECT 4, 'student' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE id = 4);

-- 2. Baseline Departments
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 1, 'CSE- (CYS, DS) and AI&DS', 'CSE', 'CSE & IT', 1, 1000 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 1);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 2, 'Automobile Engineering', 'AE', 'ENGINEERING', 1, 10 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 2);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 3, 'Biotechnology', 'BT', 'ENGINEERING', 1, 20 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 3);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 4, 'Civil Engineering', 'CE', 'ENGINEERING', 1, 30 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 4);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 5, 'Electrical & Electronics Engineering', 'EEE', 'ENGINEERING', 1, 40 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 5);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 6, 'Electronics and Communication Engineering', 'ECE', 'ENGINEERING', 1, 50 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 6);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 7, 'Electronics Engineering – VLSI Design and Technology', 'EVL', 'ENGINEERING', 1, 60 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 7);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 8, 'Electronics and Instrumentation Engineering', 'EIE', 'ENGINEERING', 1, 70 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 8);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 9, 'Mechanical Engineering', 'ME', 'ENGINEERING', 1, 80 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 9);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 10, 'Computer Science & Engineering', 'CSECORE', 'CSE & IT', 1, 10 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 10);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 11, 'Computer Science and Business Systems', 'CSBS', 'CSE & IT', 1, 20 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 11);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 12, 'CSE – Artificial Intelligence & Machine Learning', 'AIML', 'CSE & IT', 1, 30 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 12);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 13, 'CSE – Internet of Things', 'IOT', 'CSE & IT', 1, 40 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 13);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 14, 'CSE – Robotics & Artificial Intelligence', 'RAI', 'CSE & IT', 1, 50 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 14);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 15, 'CSE – Cyber Security', 'CYS', 'CSE & IT', 1, 60 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 15);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 16, 'CSE – Data Science', 'DS', 'CSE & IT', 1, 70 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 16);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 17, 'Artificial Intelligence & Data Science', 'AIDS', 'CSE & IT', 1, 80 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 17);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 18, 'Information Technology', 'IT', 'CSE & IT', 1, 90 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 18);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 19, 'Chemistry', 'CHEM', 'SCIENCES & HUMANITIES', 1, 10 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 19);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 20, 'English', 'ENG', 'SCIENCES & HUMANITIES', 1, 20 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 20);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 21, 'Mathematics & Management Sciences', 'MMS', 'SCIENCES & HUMANITIES', 1, 30 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 21);
INSERT INTO departments (id, name, code, display_group, active, sort_order) SELECT 22, 'Physics', 'PHY', 'SCIENCES & HUMANITIES', 1, 40 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 22);

-- 3. Baseline Academic Regulations
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 1, 'R25', 'R25', '2025 onwards', 'Academic regulation R25 for the applicable admission cohorts.', 1, 1 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 1);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 2, 'R22', 'R22', '2022 onwards', 'Academic regulation R22 for the applicable admission cohorts.', 1, 2 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 2);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 3, 'A19', 'A19', '2019 onwards', 'Academic regulation A19 for the applicable admission cohorts.', 1, 3 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 3);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 4, 'R19', 'R19', '2019 onwards', 'Academic regulation R19 for the applicable admission cohorts.', 1, 4 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 4);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 5, 'R18', 'R18', '2018 onwards', 'Academic regulation R18 for the applicable admission cohorts.', 1, 5 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 5);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 6, 'R15', 'R15', '2015 onwards', 'Academic regulation R15 for the applicable admission cohorts.', 1, 6 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 6);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 7, 'R13', 'R13', '2013 onwards', 'Academic regulation R13 for the applicable admission cohorts.', 1, 7 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 7);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 8, 'R12', 'R12', '2012 onwards', 'Academic regulation R12 for the applicable admission cohorts.', 1, 8 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 8);
INSERT INTO academic_regulations (id, code, display_name, effective_from, description, active, sort_order) SELECT 9, 'R11', 'R11', '2011 onwards', 'Academic regulation R11 for the applicable admission cohorts.', 1, 9 WHERE NOT EXISTS (SELECT 1 FROM academic_regulations WHERE id = 9);

-- 4. Initial System Settings (Default branding & constraints - never overwrites existing)
INSERT INTO system_settings (id, college_name, system_name, college_logo, system_logo, max_upload_size_mb, allowed_file_types, student_self_registration)
SELECT 1, 'Faculty File Management System', 'Faculty File Management System', '/logo.png', '/logo.png', 1024, 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,jpg,jpeg,png,gif,svg,mp4,mov,avi,mp3,wav,zip,rar', 0
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 1);
