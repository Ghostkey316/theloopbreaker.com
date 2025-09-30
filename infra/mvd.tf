terraform {
  required_version = ">= 1.4.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  description = "AWS region to deploy the minimum viable Vaultfire stack."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment label used for tagging."
  type        = string
  default     = "mvd"
}

variable "service_name" {
  description = "Base name applied to ECS services and load balancers."
  type        = string
  default     = "vaultfire"
}

variable "container_image" {
  description = "Container image for the Trust Sync API."
  type        = string
  default     = "public.ecr.aws/vaultfire/trust-sync:latest"
}

variable "partner_sync_container_image" {
  description = "Container image for the Partner Sync service."
  type        = string
  default     = "public.ecr.aws/vaultfire/partner-sync:latest"
}

variable "desired_count" {
  description = "Number of Fargate tasks to run."
  type        = number
  default     = 2
}

locals {
  name = "${var.service_name}-${var.environment}"
  tags = {
    Project     = "Vaultfire"
    Environment = var.environment
  }
}

resource "aws_vpc" "this" {
  cidr_block           = "10.40.0.0/16"
  enable_dns_hostnames = true
  tags                 = merge(local.tags, { Name = "${local.name}-vpc" })
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(aws_vpc.this.cidr_block, 4, count.index)
  map_public_ip_on_launch = true
  availability_zone       = element(data.aws_availability_zones.available.names, count.index)
  tags                    = merge(local.tags, { Name = "${local.name}-public-${count.index}" })
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = "${local.name}-igw" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = "${local.name}-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Allow inbound HTTP"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 81
    to_port     = 81
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-alb-sg" })
}

resource "aws_security_group" "service" {
  name        = "${local.name}-svc"
  description = "Allow traffic from the ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    description      = "Trust Sync"
    from_port        = 4002
    to_port          = 4002
    protocol         = "tcp"
    security_groups  = [aws_security_group.alb.id]
  }

  ingress {
    description      = "Partner Sync"
    from_port        = 4050
    to_port          = 4050
    protocol         = "tcp"
    security_groups  = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, { Name = "${local.name}-svc-sg" })
}

resource "aws_lb" "this" {
  name               = substr("${local.name}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = merge(local.tags, { Name = "${local.name}-alb" })
}

resource "aws_lb_target_group" "trust_sync" {
  name        = substr("${local.name}-trust", 0, 32)
  port        = 4002
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"
  health_check {
    path                = "/health"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
  }
  tags = local.tags
}

resource "aws_lb_target_group" "partner_sync" {
  name        = substr("${local.name}-partner", 0, 32)
  port        = 4050
  protocol    = "HTTP"
  vpc_id      = aws_vpc.this.id
  target_type = "ip"
  health_check {
    path                = "/status"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
  }
  tags = local.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.trust_sync.arn
  }
}

resource "aws_lb_listener" "partner" {
  load_balancer_arn = aws_lb.this.arn
  port              = 81
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.partner_sync.arn
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${local.name}-cluster"
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = local.tags
}

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_ecs_task_definition" "this" {
  family                   = local.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "trust-sync"
      image     = var.container_image
      essential = true
      portMappings = [
        {
          containerPort = 4002
          hostPort      = 4002
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "PORT"
          value = "4002"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "trust-sync"
        }
      }
    },
    {
      name      = "partner-sync"
      image     = var.partner_sync_container_image
      essential = true
      portMappings = [
        {
          containerPort = 4050
          hostPort      = 4050
          protocol      = "tcp"
        }
      ]
      environment = [
        {
          name  = "PARTNER_SYNC_PORT"
          value = "4050"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "partner-sync"
        }
      }
    }
  ])

  tags = local.tags
}

resource "aws_ecs_service" "this" {
  name            = "${local.name}-service"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.public[*].id
    security_groups = [aws_security_group.service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.trust_sync.arn
    container_name   = "trust-sync"
    container_port   = 4002
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.partner_sync.arn
    container_name   = "partner-sync"
    container_port   = 4050
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = local.tags
}

output "alb_dns_name" {
  description = "DNS name for the Application Load Balancer."
  value       = aws_lb.this.dns_name
}

output "metrics_endpoints" {
  description = "Path mappings for scraping Prometheus metrics."
  value = {
    trust_sync   = "http://${aws_lb.this.dns_name}/metrics/ops"
    partner_sync = "http://${aws_lb.this.dns_name}:81/metrics/ops"
  }
}
