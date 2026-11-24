-- Taskly admin private calls V17.
-- Signaling metadata only.
-- No media, room tokens or encryption keys.
-- Do not execute on production yet.

CREATE TABLE IF NOT EXISTS taskly_admin_private_calls (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,

    thread_id BIGINT UNSIGNED NOT NULL,
    caller_user_id INT NOT NULL,
    recipient_user_id INT NOT NULL,

    kind ENUM('audio','video') NOT NULL,

    state ENUM(
        'ringing',
        'accepted',
        'rejected',
        'cancelled',
        'missed',
        'ended'
    ) NOT NULL,

    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) NOT NULL,

    cleanup_stage TINYINT UNSIGNED NOT NULL DEFAULT 0,
    cleanup_next_at DATETIME(3) NULL,

    PRIMARY KEY (id),

    KEY idx_apv17_cleanup (
        state,cleanup_stage,cleanup_next_at
    ),

    KEY idx_apv17_call_thread (
        thread_id,state,created_at
    ),

    KEY idx_apv17_call_recipient (
        recipient_user_id,state,expires_at
    ),

    CONSTRAINT fk_apv17_call_thread
        FOREIGN KEY (thread_id)
        REFERENCES taskly_admin_private_threads(id)
        ON DELETE CASCADE

) DEFAULT CHARACTER SET utf8mb4;