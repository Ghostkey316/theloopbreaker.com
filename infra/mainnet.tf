terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    base = {
      source  = "xops/base"
      version = ">= 0.1.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "base" {
  rpc_url = var.base_rpc_url
}

variable "aws_region" {
  description = "AWS region for sovereign resonance compute."
  type        = string
  default     = "us-east-1"
}

variable "base_rpc_url" {
  description = "Base mainnet RPC endpoint used by the guardian resonance workers."
  type        = string
  default     = "https://mainnet.base.org"
}

variable "guardian_image" {
  description = "Container image that runs the resonance guardian Streamlit dashboard."
  type        = string
  default     = "public.ecr.aws/vaultfire/resonance-guardian:latest"
}

variable "vow_worker_image" {
  description = "Container image powering the retro-yield worker that calls BeliefOracle."
  type        = string
  default     = "public.ecr.aws/vaultfire/freedom-vow-worker:latest"
}

locals {
  name_prefix = "vaultfire-freedom"
  tags = {
    Project     = "Vaultfire"
    Environment = "mainnet"
    Chapter     = "freedom-vow"
  }
}

resource "aws_cloudwatch_log_group" "resonance" {
  name              = "/vaultfire/mainnet/resonance"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_cluster" "sovereign" {
  name = "${local.name_prefix}-cluster"
  tags = local.tags
}

resource "aws_ecs_task_definition" "resonance_dashboard" {
  family                   = "${local.name_prefix}-dashboard"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"

  execution_role_arn = aws_iam_role.task_execution.arn
  task_role_arn      = aws_iam_role.guardian_runtime.arn

  container_definitions = jsonencode([
    {
      name  = "dashboard"
      image = var.guardian_image
      essential = true
      portMappings = [{ containerPort = 8501, hostPort = 8501 }]
      environment = [
        { name = "BASE_RPC_URL", value = var.base_rpc_url },
        { name = "BELIEF_ORACLE_ADDRESS", value = base_oracle_record.oracle_address },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.resonance.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "dashboard"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "resonance_worker" {
  family                   = "${local.name_prefix}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  execution_role_arn = aws_iam_role.task_execution.arn
  task_role_arn      = aws_iam_role.guardian_runtime.arn

  container_definitions = jsonencode([
    {
      name  = "worker"
      image = var.vow_worker_image
      essential = true
      environment = [
        { name = "REWARD_STREAM_ADDRESS", value = base_oracle_record.reward_stream_address },
        { name = "DILITHIUM_ATTESTOR", value = base_oracle_record.attestor_address },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.resonance.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "worker"
        }
      }
    }
  ])
}

resource "aws_iam_role" "task_execution" {
  name = "${local.name_prefix}-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = merge(local.tags, { Role = "execution" })
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "guardian_runtime" {
  name = "${local.name_prefix}-runtime"
  assume_role_policy = aws_iam_role.task_execution.assume_role_policy
  tags               = merge(local.tags, { Role = "runtime" })
}

resource "aws_ecs_service" "dashboard" {
  name            = "${local.name_prefix}-dashboard"
  cluster         = aws_ecs_cluster.sovereign.id
  task_definition = aws_ecs_task_definition.resonance_dashboard.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    assign_public_ip = true
    security_groups = [aws_security_group.guardian.id]
  }

  tags = merge(local.tags, { Component = "dashboard" })
}

resource "aws_ecs_service" "worker" {
  name            = "${local.name_prefix}-worker"
  cluster         = aws_ecs_cluster.sovereign.id
  task_definition = aws_ecs_task_definition.resonance_worker.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = data.aws_subnets.public.ids
    assign_public_ip = true
    security_groups = [aws_security_group.guardian.id]
  }

  tags = merge(local.tags, { Component = "worker" })
}

resource "aws_security_group" "guardian" {
  name        = "${local.name_prefix}-sg"
  description = "Allow Streamlit dashboard access"
  vpc_id      = data.aws_vpc.selected.id

  ingress {
    description = "Streamlit"
    from_port   = 8501
    to_port     = 8501
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Component = "security" })
}

data "aws_vpc" "selected" {
  default = true
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.selected.id]
  }
}

# Stub provider record linking on-chain deployments with the worker fleet.
resource "base_oracle_record" "this" {
  provider = base

  name                  = "vaultfire-freedom"
  oracle_address        = var.oracle_address
  reward_stream_address = var.reward_stream_address
  attestor_address      = var.attestor_address
}

variable "oracle_address" {
  description = "BeliefOracle deployment address"
  type        = string
}

variable "reward_stream_address" {
  description = "RewardStream deployment address"
  type        = string
}

variable "attestor_address" {
  description = "DilithiumAttestor deployment address"
  type        = string
}
