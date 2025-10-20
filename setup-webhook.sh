#!/bin/bash

# Stripe Webhook Setup Script for Local Development

echo "🔧 Stripe Webhook Setup for Local Development"
echo "=============================================="
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI is not installed!"
    echo ""
    echo "Please install it first:"
    echo "  macOS: brew install stripe/stripe-cli/stripe"
    echo "  Linux: https://stripe.com/docs/stripe-cli#install"
    echo "  Windows: https://github.com/stripe/stripe-cli/releases"
    echo ""
    exit 1
fi

echo "✅ Stripe CLI is installed"
echo ""

# Check if logged in
if ! stripe config --list &> /dev/null; then
    echo "🔐 You need to log in to Stripe first"
    echo "Running: stripe login"
    echo ""
    stripe login
    echo ""
fi

echo "✅ Logged in to Stripe"
echo ""

# Check if server is running
if ! curl -s http://localhost:5000/api/v1/subscription/webhook/test > /dev/null 2>&1; then
    echo "⚠️  WARNING: Server doesn't seem to be running on port 5000"
    echo ""
    echo "Please start your server first:"
    echo "  cd server"
    echo "  PORT=5000 yarn start:dev"
    echo ""
    read -p "Press Enter when server is ready, or Ctrl+C to exit..."
    echo ""
fi

# Test the endpoint
echo "Testing webhook endpoint..."
RESPONSE=$(curl -s http://localhost:5000/api/v1/subscription/webhook/test)
echo "Response: $RESPONSE"
echo ""

if [[ $RESPONSE == *"Webhook endpoint is accessible"* ]]; then
    echo "✅ Webhook endpoint is accessible!"
else
    echo "❌ Webhook endpoint is not accessible"
    echo "Make sure your server is running on port 5000"
    exit 1
fi

echo ""
echo "🚀 Starting Stripe webhook forwarding..."
echo ""
echo "⚠️  IMPORTANT: Copy the webhook signing secret that appears below"
echo "    It looks like: whsec_xxxxxxxxxxxxxxxxxxxxx"
echo ""
echo "    Add it to your server/.env file:"
echo "    STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx"
echo ""
echo "    Then restart your server!"
echo ""
echo "=============================================="
echo ""

# Start listening for webhooks
stripe listen --forward-to localhost:5000/api/v1/subscription/webhook

echo ""
echo "Webhook forwarding stopped"

