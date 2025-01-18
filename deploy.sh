#!/bin/bash

# Configuration
AWS_REGION="us-east-1"
ECR_REPO="ai-langlearn-agent"
CLUSTER_NAME="langlearn-agent-cluster"
SERVICE_NAME="langlearn-agent-service"
TASK_FAMILY="langlearn-agent"
TARGET_GROUP_ARN="arn:aws:elasticloadbalancing:us-east-1:654654451063:targetgroup/langlearn-agent-tg/f5ed6baa2e549f5f"

# Function to handle errors
error_exit() {
    echo "Error: $1"
    echo "Press Enter to exit..."
    read
    exit 1
}

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    echo "Please install jq using one of these methods:"
    echo "- Windows (with chocolatey): choco install jq"
    echo "- Mac: brew install jq"
    echo "- Linux: sudo apt-get install jq"
    echo "Press Enter to exit..."
    read
    exit 1
fi

# Get AWS account ID
echo "Getting AWS account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text) || error_exit "Failed to get AWS account ID. Please check your AWS credentials."

# ECR login
echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com || error_exit "ECR login failed"

# Build Docker image
echo "Building Docker image..."
MSYS_NO_PATHCONV=1 docker build -t $ECR_REPO:latest . || error_exit "Docker build failed"

# Tag image for ECR
echo "Tagging image..."
docker tag $ECR_REPO:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest || error_exit "Failed to tag Docker image"

# Push to ECR
echo "Pushing to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest || error_exit "Failed to push to ECR"

# Update target group health check settings
echo "Updating target group health check settings..."
MSYS_NO_PATHCONV=1 aws elbv2 modify-target-group \
    --target-group-arn "$TARGET_GROUP_ARN" \
    --health-check-path //health \
    --health-check-interval-seconds 60 \
    --health-check-timeout-seconds 10 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region $AWS_REGION || error_exit "Failed to update target group settings"

# Get current task definition
echo "Getting current task definition..."
TASK_DEFINITION=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $AWS_REGION) || error_exit "Failed to get task definition"

# Create new task definition
echo "Creating new task definition..."
NEW_TASK_DEFINITION=$(echo $TASK_DEFINITION | jq --arg IMAGE "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest" \
    '.taskDefinition | .containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)') || error_exit "Failed to create new task definition"

# Register new task definition
echo "Registering new task definition..."
NEW_TASK_INFO=$(aws ecs register-task-definition --region $AWS_REGION --cli-input-json "$NEW_TASK_DEFINITION") || error_exit "Failed to register task definition"
NEW_REVISION=$(echo $NEW_TASK_INFO | jq -r '.taskDefinition.revision') || error_exit "Failed to get task definition revision"

# Update service
echo "Updating ECS service..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $TASK_FAMILY:$NEW_REVISION \
    --force-new-deployment \
    --region $AWS_REGION || error_exit "Failed to update ECS service"

echo "Deployment initiated! Monitoring service update..."

# Monitor deployment
while true; do
    # Get service events
    SERVICE_INFO=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION) || {
        echo "Failed to get service status"
        echo "Press Enter to exit..."
        read
        exit 1
    }
    
    # Get deployment status
    DEPLOYMENT_STATUS=$(echo $SERVICE_INFO | jq -r '.services[0].deployments[0].rolloutState')
    RUNNING_COUNT=$(echo $SERVICE_INFO | jq -r '.services[0].runningCount')
    DESIRED_COUNT=$(echo $SERVICE_INFO | jq -r '.services[0].desiredCount')
    
    # Get the latest deployment details
    LATEST_EVENT=$(echo $SERVICE_INFO | jq -r '.services[0].events[0].message')
    DEPLOYMENT_REASON=$(echo $SERVICE_INFO | jq -r '.services[0].deployments[0].rolloutStateReason')
    
    echo "----------------------------------------"
    echo "Deployment Status: $DEPLOYMENT_STATUS | Running: $RUNNING_COUNT/$DESIRED_COUNT tasks"
    echo "Latest Event: $LATEST_EVENT"
    echo "Deployment Reason: $DEPLOYMENT_REASON"
    
    # Check if any tasks are unhealthy
    TASK_IDS=$(echo $SERVICE_INFO | jq -r '.services[0].deployments[0].taskIds[]' 2>/dev/null)
    if [ ! -z "$TASK_IDS" ]; then
        echo "Checking task health..."
        for TASK_ID in $TASK_IDS; do
            TASK_INFO=$(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ID --region $AWS_REGION)
            TASK_STATUS=$(echo $TASK_INFO | jq -r '.tasks[0].lastStatus')
            TASK_HEALTH=$(echo $TASK_INFO | jq -r '.tasks[0].healthStatus')
            echo "Task $TASK_ID: Status=$TASK_STATUS, Health=$TASK_HEALTH"
        done
    fi
    echo "----------------------------------------"
    
    if [ "$DEPLOYMENT_STATUS" = "COMPLETED" ]; then
        echo "Deployment completed successfully!"
        break
    elif [ "$DEPLOYMENT_STATUS" = "FAILED" ]; then
        echo "Deployment failed! Check ECS console for details."
        echo "Latest Event: $LATEST_EVENT"
        echo "Deployment Reason: $DEPLOYMENT_REASON"
        echo "Press Enter to exit..."
        read
        exit 1
    fi
    
    sleep 10
done

# Test the health endpoint
echo "Testing API health..."
sleep 10  # Give load balancer time to register new tasks
HEALTH_CHECK=$(curl -s https://api.laingfy.com/health)
if [ $? -eq 0 ]; then
    echo "API is healthy: $HEALTH_CHECK"
else
    echo "Warning: Health check failed. Please verify the API manually."
    echo "Press Enter to exit..."
    read
fi 