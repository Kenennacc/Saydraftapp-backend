#!/bin/bash

RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
MAGENTA="\033[35m"
CYAN="\033[36m"
RESET="\033[0m"
BOLD="\033[1m"


if [ $# -eq 0 ]; then
    echo -e "${RED}You must provide the script to run as an argument.${RESET}"
    echo -e "Usage: $0 <anyscript.sh> or 'npm start' (entirely up to you :))"
    exit 1
fi


clear


echo -e "${CYAN}${BOLD}"
echo "#                         _            __ _"   
echo "#     ___  __ _ _   _  __| |_ __ __ _ / _| |_" 
echo "#    / __|/ _  | | | |/ _  |  __/ _  | |_| __|"
echo "#    \__ \ (_| | |_| | (_| | | | (_| |  _| |_" 
echo "#    |___/\__,_|\__, |\__,_|_|  \__,_|_|  \__|"
echo "#               |___/                         "
echo -e "${RESET}"

echo -e "${YELLOW}Welcome to SayDraft Pre-Setup (I suck at naming things)!${RESET}"
echo -e "${GREEN}Before proceeding, make sure you have:${RESET}"
echo -e "${MAGENTA}- Saved all your work"
echo -e "- Closed other important programs"
echo -e "- ALWAYS UPDATE THE '.env.example' anytime you update the '.env'"

echo
echo -e "${CYAN}Press ${BOLD}ENTER${RESET}${CYAN} to continue...${RESET}"
read -r


echo -e "${GREEN}Running: $*${RESET}"
$@
EXIT_CODE=$?


if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Command completed successfully!${RESET}"
else
    echo -e "${RED}Command failed with exit code $EXIT_CODE${RESET}"
fi