# Mint Clone Backend

Enterprise-grade backend monorepo for the Mint Clone personal finance management platform. This repository contains a collection of microservices that power the core functionality of the application.

## System Requirements

- Node.js >= 18.0.0
- Docker >= 20.10.0
- PostgreSQL >= 14.0
- MongoDB >= 6.0.0
- Redis >= 7.0.0

## Architecture Overview

The backend is built using a microservices architecture with the following components:

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 3000 | Entry point for all client requests with rate limiting and routing |
| Auth Service | 3001 | Handles authentication, authorization and user management |
| Account Service | 3002 | Manages financial account connections and Plaid integration |
| Transaction Service | 3003 | Processes and categorizes financial transactions |
| Budget Service | 3004 | Manages budget creation, tracking and alerts |
| Investment Service | 3005 | Handles investment portfolio tracking and analysis |

## Getting Started

### Prerequisites

1. Install Node.js (v18.0.0 or higher)
2. Install Docker and Docker Compose
3. Clone the repository

### Environment Setup

1. Create environment files for each service:
```bash
cp .env.example .env
```

2. Configure the following environment variables:
```
POSTGRES_PASSWORD=<your-postgres-password>
MONGO_ROOT_USERNAME=<your-mongo-username>
MONGO_ROOT_PASSWORD=<your-mongo-password>
REDIS_PASSWORD=<your-redis-password>
```

### Installation

1. Install dependencies:
```bash
npm install
npm run bootstrap
```

2. Build all services:
```bash
npm run build
```

3. Start the development environment:
```bash
npm run docker:up
```

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run bootstrap` | Install dependencies for all packages |
| `npm run build` | Build all packages |
| `npm run test` | Run tests across all packages |
| `npm run dev` | Start all services in development mode |
| `npm run lint` | Run linting across all packages |
| `npm run docker:up` | Start all services in Docker containers |

### Project Structure

```
src/backend/
├── api-gateway/        # API Gateway service
├── auth-service/       # Authentication service
├── account-service/    # Account management service
├── transaction-service/# Transaction processing service
├── budget-service/     # Budget management service
├── investment-service/ # Investment tracking service
├── shared/            # Shared utilities and types
└── docker-compose.yml # Container orchestration
```

## Database Architecture

### PostgreSQL Databases

- **Transactions DB**: Stores financial transaction data
- **Accounts DB**: Stores financial account information
- **Budgets DB**: Stores budget configurations and tracking
- **Investments DB**: Stores investment portfolio data

### MongoDB Collections

- **Users**: User profiles and authentication data
- **Sessions**: User session management
- **Audit Logs**: Security and operation audit trails

### Redis Cache

- Session data
- Rate limiting
- API response caching

## API Documentation

API documentation is available at:
- Development: http://localhost:3000/api-docs
- Staging: https://api-staging.mintclone.com/api-docs
- Production: https://api.mintclone.com/api-docs

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage Requirements

- Statements: 80%
- Branches: 80%
- Functions: 80%
- Lines: 80%

## Deployment

### Container Resources

| Service | CPU | Memory |
|---------|-----|---------|
| API Gateway | 1.0 | 2Gi |
| Auth Service | 0.5 | 1Gi |
| Account Service | 0.5 | 1Gi |
| Transaction Service | 1.0 | 2Gi |
| Budget Service | 0.5 | 1Gi |
| Investment Service | 0.5 | 1Gi |

### Health Checks

All services implement health check endpoints at `/health` with:
- Interval: 30s
- Timeout: 10s
- Retries: 3

## Security

### Authentication

- JWT-based authentication
- OAuth 2.0 implementation
- MFA support via authenticator apps
- Session management with Redis

### Data Protection

- TLS 1.3 for all communications
- AES-256 encryption at rest
- AWS KMS for key management
- CORS configuration

## Monitoring

### Metrics

- Prometheus metrics exposed at `/metrics`
- Custom business metrics for each service
- Request latency tracking
- Error rate monitoring

### Logging

- Centralized logging with Winston
- Log rotation with daily archives
- Correlation IDs for request tracking
- Error stack traces in development

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT License - see LICENSE file for details