-- 审批流引擎 H2 测试 DDL（MODE=MySQL）
-- LONGTEXT → TEXT，其余与 MySQL 版一致；无 ON UPDATE CURRENT_TIMESTAMP

CREATE TABLE IF NOT EXISTS wf_process_definition (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  version     INT          NOT NULL DEFAULT 1,
  graph_json  TEXT         NOT NULL,
  status      VARCHAR(20)  NOT NULL,
  description VARCHAR(255) NULL,
  deleted     TINYINT      NOT NULL DEFAULT 0,
  create_time TIMESTAMP    NOT NULL,
  update_time TIMESTAMP    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_code_version ON wf_process_definition(code, version);

CREATE TABLE IF NOT EXISTS wf_node_definition (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  def_id          BIGINT       NOT NULL,
  node_key        VARCHAR(64)  NOT NULL,
  node_type       VARCHAR(20)  NOT NULL,
  node_name       VARCHAR(128) NULL,
  assignee_type   VARCHAR(30)  NULL,
  assignee_config TEXT         NULL,
  multi_mode      VARCHAR(10)  NULL,
  reject_strategy VARCHAR(30)  NULL,
  allow_reject    TINYINT      NOT NULL DEFAULT 0,
  allow_transfer  TINYINT      NOT NULL DEFAULT 0,
  sort_order      INT          NOT NULL DEFAULT 0,
  create_time     TIMESTAMP    NOT NULL,
  update_time     TIMESTAMP    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_def_node ON wf_node_definition(def_id, node_key);
CREATE INDEX IF NOT EXISTS idx_def ON wf_node_definition(def_id);

CREATE TABLE IF NOT EXISTS wf_process_instance (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  def_id           BIGINT       NOT NULL,
  def_version      INT          NOT NULL,
  title            VARCHAR(128) NOT NULL,
  business_key     VARCHAR(64)  NULL,
  form_json        TEXT         NULL,
  initiator_id     BIGINT       NOT NULL,
  current_node_key VARCHAR(64)  NOT NULL,
  current_round    INT          NOT NULL DEFAULT 1,
  chosen_user_ids  TEXT         NULL,
  status           VARCHAR(20)  NOT NULL,
  start_time       TIMESTAMP    NOT NULL,
  end_time         TIMESTAMP    NULL,
  create_time      TIMESTAMP    NOT NULL,
  update_time      TIMESTAMP    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_initiator ON wf_process_instance(initiator_id);
CREATE INDEX IF NOT EXISTS idx_def ON wf_process_instance(def_id);

CREATE TABLE IF NOT EXISTS wf_task (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT       NOT NULL,
  node_key    VARCHAR(64)  NOT NULL,
  node_name   VARCHAR(128) NULL,
  node_type   VARCHAR(20)  NOT NULL,
  assignee_id BIGINT       NOT NULL,
  status      VARCHAR(20)  NOT NULL,
  action      VARCHAR(20)  NULL,
  comment     VARCHAR(512) NULL,
  round       INT          NOT NULL DEFAULT 1,
  create_time TIMESTAMP    NOT NULL,
  finish_time TIMESTAMP    NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_task ON wf_task(instance_id, node_key, assignee_id, round);
CREATE INDEX IF NOT EXISTS idx_assignee ON wf_task(assignee_id, status);

CREATE TABLE IF NOT EXISTS wf_task_record (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT       NOT NULL,
  task_id     BIGINT       NULL,
  node_key    VARCHAR(64)  NOT NULL,
  node_name   VARCHAR(128) NULL,
  operator_id BIGINT       NOT NULL,
  action      VARCHAR(20)  NOT NULL,
  comment     VARCHAR(512) NULL,
  round       INT          NOT NULL DEFAULT 1,
  create_time TIMESTAMP    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_instance ON wf_task_record(instance_id);
