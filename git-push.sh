#!/bin/bash

# Git Push Script for CLARENCE Project
# Usage: ./git-push.sh "Your commit message"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== CLARENCE Git Push Script ===${NC}\n"

# Check if a commit message was provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}No commit message provided. Please enter a commit message:${NC}"
    read -p "Commit message: " COMMIT_MSG
    
    if [ -z "$COMMIT_MSG" ]; then
        echo -e "${RED}Error: Commit message cannot be empty${NC}"
        exit 1
    fi
else
    COMMIT_MSG="$1"
fi

# Show current status
echo -e "${YELLOW}Current git status:${NC}"
git status --short
echo ""

# Ask for confirmation to proceed
read -p "Do you want to add all changes and commit? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Operation cancelled${NC}"
    exit 1
fi

# Add all changes
echo -e "\n${GREEN}Adding all changes...${NC}"
git add -A

# Show what's being committed
echo -e "\n${YELLOW}Files being committed:${NC}"
git status --short
echo ""

# Commit with the provided message
echo -e "${GREEN}Committing with message:${NC} $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# Check if commit was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}Commit successful!${NC}"
else
    echo -e "\n${RED}Commit failed. Please check for errors.${NC}"
    exit 1
fi

# Push to main branch
echo -e "\n${GREEN}Pushing to origin main...${NC}"
git push origin main

# Check if push was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Successfully pushed to origin main!${NC}"
    
    # Show the latest commit
    echo -e "\n${YELLOW}Latest commit:${NC}"
    git log -1 --pretty=format:"%h - %an, %ar : %s"
    echo -e "\n"
else
    echo -e "\n${RED}Push failed. Please check your connection and try again.${NC}"
    echo -e "${YELLOW}Your changes are committed locally but not pushed.${NC}"
    exit 1
fi

echo -e "${GREEN}=== Complete! ===${NC}"