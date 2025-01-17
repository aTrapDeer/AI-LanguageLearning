#!/bin/bash

# Copy proxy server file to EC2
scp -i ec2bridge.pem proxy-server.js ec2-user@ec2-44-217-124-246.compute-1.amazonaws.com:~/proxy-server.js

# SSH into EC2 and set up Node.js
ssh -i ec2bridge.pem ec2-user@ec2-44-217-124-246.compute-1.amazonaws.com '
  # Update system
  sudo yum update -y
  
  # Install Node.js
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
  . ~/.nvm/nvm.sh
  nvm install 16
  
  # Install PM2 for process management
  npm install -g pm2
  
  # Start proxy server with PM2
  pm2 start proxy-server.js
  
  # Save PM2 process list
  pm2 save
  
  # Set PM2 to start on boot
  pm2 startup
' 