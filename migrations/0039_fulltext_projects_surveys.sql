-- Migration 0039: Add FULLTEXT indexes for project and survey search
ALTER TABLE projects ADD FULLTEXT IF NOT EXISTS idx_ft_projects_name (name);
ALTER TABLE projects ADD FULLTEXT IF NOT EXISTS idx_ft_projects_description (description);

ALTER TABLE surveys ADD FULLTEXT IF NOT EXISTS idx_ft_surveys_title (title);
ALTER TABLE surveys ADD FULLTEXT IF NOT EXISTS idx_ft_surveys_description (description);
