-- name: list_surveys
SELECT s.*, u.username AS creator_username
FROM surveys s
JOIN users u ON u.user_id = s.creator_id
ORDER BY s.created_at DESC;

-- name: get_survey
SELECT s.*, u.username AS creator_username
FROM surveys s
JOIN users u ON u.user_id = s.creator_id
WHERE s.survey_id = :id;

-- name: create_survey
INSERT INTO surveys (title, description, creator_id, is_anonymous, expires_at, created_at)
VALUES (:title, :description, :creator_id, :is_anonymous, :expires_at, NOW());

-- name: get_questions
SELECT * FROM survey_questions WHERE survey_id = :survey_id ORDER BY position;

-- name: get_options
SELECT * FROM survey_options WHERE question_id = :question_id ORDER BY position;

-- name: get_responses
SELECT r.* FROM survey_responses r
JOIN survey_questions q ON q.question_id = r.question_id
WHERE q.survey_id = :survey_id;

-- name: save_response
INSERT INTO survey_responses (question_id, user_id, option_id, text_value, created_at)
VALUES (:question_id, :user_id, :option_id, :text_value, NOW());
