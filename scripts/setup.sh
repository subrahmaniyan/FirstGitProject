#!/bin/bash

# Payment Switch Application Setup Script
# This script sets up the development environment and installs all dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            print_success "Node.js version $NODE_VERSION is compatible"
            return 0
        else
            print_error "Node.js version $NODE_VERSION is not compatible. Please install Node.js 18.0.0 or higher"
            return 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 18.0.0 or higher"
        return 1
    fi
}

# Function to check npm version
check_npm_version() {
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm version $NPM_VERSION found"
        return 0
    else
        print_error "npm is not installed"
        return 1
    fi
}

# Function to check Docker
check_docker() {
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_success "Docker version $DOCKER_VERSION found"
        
        if command_exists docker-compose; then
            COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
            print_success "Docker Compose version $COMPOSE_VERSION found"
            return 0
        else
            print_warning "Docker Compose not found. Please install Docker Compose"
            return 1
        fi
    else
        print_warning "Docker not found. Docker is recommended for easy deployment"
        return 1
    fi
}

# Function to create directories
create_directories() {
    print_status "Creating necessary directories..."
    
    directories=(
        "logs"
        "logs/nginx"
        "data/mongodb"
        "data/redis"
        "data/node-red"
        "nginx/ssl"
        "docs"
        "tests/unit"
        "tests/integration"
        "tests/e2e"
        "shared/models"
        "shared/utils"
        "shared/security"
        "shared/compliance"
        "shared/logging"
        "shared/monitoring"
        "shared/message-formats"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    print_success "All directories created successfully"
}

# Function to copy environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Environment file created from template"
            print_warning "Please review and update the .env file with your specific configuration"
        else
            print_error ".env.example file not found"
            return 1
        fi
    else
        print_warning ".env file already exists, skipping..."
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    print_status "Installing root dependencies..."
    npm install
    
    # Install service dependencies
    services=(
        "services/transaction-processor"
        "services/routing-engine"
        "services/psp-gateway"
        "services/management-api"
        "services/monitoring"
        "frontend"
    )
    
    for service in "${services[@]}"; do
        if [ -d "$service" ] && [ -f "$service/package.json" ]; then
            print_status "Installing dependencies for $service..."
            (cd "$service" && npm install)
            print_success "Dependencies installed for $service"
        else
            print_warning "Service directory $service not found or no package.json"
        fi
    done
    
    print_success "All dependencies installed successfully"
}

# Function to generate SSL certificates (self-signed for development)
generate_ssl_certificates() {
    print_status "Generating SSL certificates for development..."
    
    if [ ! -f "nginx/ssl/payment-switch.crt" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/payment-switch.key \
            -out nginx/ssl/payment-switch.crt \
            -subj "/C=US/ST=State/L=City/O=PaymentSwitch/CN=localhost"
        
        print_success "SSL certificates generated"
        print_warning "These are self-signed certificates for development only"
    else
        print_warning "SSL certificates already exist, skipping..."
    fi
}

# Function to set file permissions
set_permissions() {
    print_status "Setting file permissions..."
    
    # Make scripts executable
    chmod +x scripts/*.sh 2>/dev/null || true
    chmod +x index.js 2>/dev/null || true
    
    # Set appropriate permissions for log directories
    chmod 755 logs 2>/dev/null || true
    chmod 755 logs/nginx 2>/dev/null || true
    
    print_success "File permissions set"
}

# Function to validate setup
validate_setup() {
    print_status "Validating setup..."
    
    # Check if all required files exist
    required_files=(
        "package.json"
        "docker-compose.yml"
        ".env"
        "index.js"
        "services/transaction-processor/package.json"
        "services/routing-engine/package.json"
        "services/psp-gateway/package.json"
        "services/management-api/package.json"
        "services/monitoring/package.json"
        "frontend/package.json"
        "node-red/flows.json"
        "node-red/settings.js"
        "nginx/nginx.conf"
    )
    
    missing_files=()
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        print_success "All required files are present"
    else
        print_error "Missing required files:"
        for file in "${missing_files[@]}"; do
            print_error "  - $file"
        done
        return 1
    fi
    
    # Check if node_modules exist for services
    for service in services/*/; do
        if [ -f "$service/package.json" ] && [ ! -d "$service/node_modules" ]; then
            print_warning "Dependencies not installed for $service"
        fi
    done
    
    print_success "Setup validation completed"
}

# Function to display next steps
show_next_steps() {
    print_success "Setup completed successfully!"
    echo
    print_status "Next steps:"
    echo "1. Review and update the .env file with your configuration"
    echo "2. Start the application using one of these methods:"
    echo "   a) Docker (recommended): npm run docker:up"
    echo "   b) Development mode: npm run dev"
    echo "   c) Production mode: npm start"
    echo
    print_status "Access points after starting:"
    echo "• Management Interface: http://localhost:8080"
    echo "• Node-RED Workflows: http://localhost:1880"
    echo "• Transaction Processor: http://localhost:3001"
    echo "• Routing Engine: http://localhost:3002"
    echo "• PSP Gateway: http://localhost:3003"
    echo "• Management API: http://localhost:3004"
    echo "• Monitoring: http://localhost:3005"
    echo
    print_status "Default credentials:"
    echo "• Node-RED: admin / admin123"
    echo "• MongoDB: admin / paymentswitch123"
    echo
    print_warning "Remember to change default passwords in production!"
}

# Main setup function
main() {
    echo "=================================================="
    echo "Payment Switch Application Setup"
    echo "=================================================="
    echo
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    
    if ! check_node_version; then
        exit 1
    fi
    
    if ! check_npm_version; then
        exit 1
    fi
    
    check_docker  # Docker is optional, so don't exit on failure
    
    # Run setup steps
    create_directories
    setup_environment
    install_dependencies
    
    # Generate SSL certificates if OpenSSL is available
    if command_exists openssl; then
        generate_ssl_certificates
    else
        print_warning "OpenSSL not found, skipping SSL certificate generation"
    fi
    
    set_permissions
    validate_setup
    
    show_next_steps
}

# Run main function
main "$@"

