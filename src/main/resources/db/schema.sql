-- 审批流引擎 MySQL 8 DDL
-- 所有表 CREATE IF NOT EXISTS，时间由 MetaObjectHandler 填充，DDL 不写 ON UPDATE

CREATE TABLE IF NOT EXISTS wf_process_definition (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(64)  NOT NULL COMMENT '流程编码',
  name        VARCHAR(128) NOT NULL COMMENT '流程名称',
  version     INT          NOT NULL DEFAULT 1 COMMENT '版本，保存即+1',
  graph_json  LONGTEXT     NOT NULL COMMENT '流程图JSON唯一真相',
  status      VARCHAR(20)  NOT NULL COMMENT 'DRAFT/ENABLED/DISABLED',
  description VARCHAR(255) NULL,
  deleted     TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
  create_time DATETIME     NOT NULL,
  update_time DATETIME     NOT NULL,
  UNIQUE KEY uk_code_version (code, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程定义';

CREATE TABLE IF NOT EXISTS wf_node_definition (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  def_id          BIGINT       NOT NULL COMMENT '所属定义id',
  node_key        VARCHAR(64)  NOT NULL COMMENT '图中节点id',
  node_type       VARCHAR(20)  NOT NULL COMMENT 'START/APPROVAL/CC/END',
  node_name       VARCHAR(128) NULL,
  assignee_type   VARCHAR(30)  NULL,
  assignee_config LONGTEXT     NULL COMMENT 'JSON，LONGTEXT不用原生JSON',
  multi_mode      VARCHAR(10)  NULL COMMENT 'ALL/ANY',
  reject_strategy VARCHAR(30)  NULL,
  allow_reject    TINYINT      NOT NULL DEFAULT 0,
  allow_transfer  TINYINT      NOT NULL DEFAULT 0,
  sort_order      INT          NOT NULL DEFAULT 0,
  create_time     DATETIME     NOT NULL,
  update_time     DATETIME     NOT NULL,
  UNIQUE KEY uk_def_node (def_id, node_key),
  KEY idx_def (def_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点定义';

CREATE TABLE IF NOT EXISTS wf_process_instance (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  def_id           BIGINT       NOT NULL COMMENT '发起时永久锁定的定义行',
  def_version      INT          NOT NULL,
  title            VARCHAR(128) NOT NULL,
  business_key     VARCHAR(64)  NULL,
  form_json        LONGTEXT     NULL,
  initiator_id     BIGINT       NOT NULL,
  current_node_key VARCHAR(64)  NOT NULL,
  current_round    INT          NOT NULL DEFAULT 1,
  chosen_user_ids  LONGTEXT     NULL COMMENT '发起人自选审批人JSON {"nodeKey":[ids]}',
  status           VARCHAR(20)  NOT NULL COMMENT 'RUNNING/APPROVED/REJECTED/CANCELLED',
  start_time       DATETIME     NOT NULL,
  end_time         DATETIME     NULL,
  create_time      DATETIME     NOT NULL,
  update_time      DATETIME     NOT NULL,
  KEY idx_initiator (initiator_id),
  KEY idx_def (def_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流程实例';

CREATE TABLE IF NOT EXISTS wf_task (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT       NOT NULL,
  node_key    VARCHAR(64)  NOT NULL,
  node_name   VARCHAR(128) NULL,
  node_type   VARCHAR(20)  NOT NULL,
  assignee_id BIGINT       NOT NULL,
  status      VARCHAR(20)  NOT NULL COMMENT 'PENDING/APPROVED/REJECTED/CANCELLED/TRANSFERRED/COMPLETED',
  action      VARCHAR(20)  NULL,
  comment     VARCHAR(512) NULL,
  round       INT          NOT NULL DEFAULT 1,
  create_time DATETIME     NOT NULL,
  finish_time DATETIME     NULL,
  UNIQUE KEY uk_task (instance_id, node_key, assignee_id, round),
  KEY idx_assignee (assignee_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批任务';

CREATE TABLE IF NOT EXISTS wf_task_record (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  instance_id BIGINT       NOT NULL,
  task_id     BIGINT       NULL,
  node_key    VARCHAR(64)  NOT NULL,
  node_name   VARCHAR(128) NULL,
  operator_id BIGINT       NOT NULL,
  action      VARCHAR(20)  NOT NULL COMMENT 'SUBMIT/APPROVE/REJECT/CC/CANCEL/FINISH',
  comment     VARCHAR(512) NULL,
  round       INT          NOT NULL DEFAULT 1,
  create_time DATETIME     NOT NULL
  -- 注意：此表无 update_time
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='流转流水';
