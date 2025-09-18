# ZeroHack - Enhanced Production-Ready Cybersecurity Platform

## 🚀 Overview

ZeroHack is a comprehensive cybersecurity platform that combines AI-powered threat detection, blockchain forensics, and autonomous response capabilities. This enhanced version provides a production-ready architecture with proper API integration, security hardening, and scalable deployment options.

## 🏗️ Architecture

### Backend (FastAPI)
- **Central API Gateway**: Single entry point for all services
- **Service Layer**: Modular services for AI, blockchain, notifications
- **Database Layer**: SQLAlchemy with async support
- **Security**: JWT authentication, 2FA, role-based access control
- **Real-time**: WebSocket support for live updates

### Frontend (Next.js 13)
- **Modern UI**: Tailwind CSS with dark theme
- **API Integration**: Centralized API client
- **Real-time Updates**: WebSocket integration
- **Responsive Design**: Mobile-first approach

### AI/ML Pipeline
- **Multi-model Detection**: Isolation Forest, Autoencoder, LSTM
- **Backend-driven Inference**: Centralized model management
- **Real-time Analysis**: Text, image, and network traffic analysis
- **Explainability**: SHAP integration for model explanations

### Blockchain Integration
- **Evidence Chain**: Immutable incident logging
- **Smart Contracts**: Automated response triggers
- **Forensics**: Tamper-proof evidence verification

## 🛠️ Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd zerohack
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8008
- **API Documentation**: http://localhost:8008/api/docs

## 🔧 Development Setup

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export ZEROHACK_DATABASE_URL="sqlite:///./zerohack.db"
export ZEROHACK_SECRET_KEY="your-secret-key"

# Run the server
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8008
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication
- Two-factor authentication (2FA) with TOTP
- Role-based access control (Admin, Analyst, Commander, Viewer)
- Password strength validation
- Session management

### API Security
- CORS protection
- Rate limiting
- Input validation with Pydantic
- SQL injection prevention
- XSS protection

### Blockchain Security
- Immutable evidence logging
- Cryptographic file hashing
- Smart contract integration
- Tamper detection

## 🤖 AI/ML Capabilities

### Threat Detection Models
1. **Isolation Forest**: Anomaly detection in network traffic
2. **Autoencoder**: Behavioral pattern analysis
3. **LSTM**: Sequential data analysis
4. **Signature Engine**: Rule-based detection

### Analysis Types
- **Text Analysis**: Code, logs, descriptions
- **Image Analysis**: Steganography detection
- **Network Traffic**: Real-time traffic analysis
- **Comprehensive**: Multi-vector analysis

### Model Management
- Centralized model loading
- Async inference
- Model status monitoring
- Retraining capabilities

## 📊 Dashboard Features

### Real-time Monitoring
- System health status
- Active threat count
- AI model status
- Blockchain connection status

### Incident Management
- Incident creation and tracking
- Evidence file upload
- Blockchain logging
- Status updates

### Analytics
- Threat heatmap
- Recent activity feed
- Performance metrics
- Model explanations

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/setup-2fa` - Setup 2FA

### Incidents
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Create incident
- `GET /api/incidents/{id}` - Get incident details
- `PUT /api/incidents/{id}` - Update incident

### AI Analysis
- `POST /api/ai/analyze/text` - Text analysis
- `POST /api/ai/analyze/image` - Image analysis
- `POST /api/ai/analyze/network` - Network analysis
- `GET /api/ai/models/status` - Model status

### Blockchain
- `GET /api/blockchain/status` - Blockchain status
- `GET /api/blockchain/evidence/{id}` - Evidence chain
- `POST /api/blockchain/verify-evidence` - Verify evidence

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/threat-heatmap` - Threat heatmap
- `GET /api/dashboard/recent-activity` - Recent activity

## 🚀 Deployment

### Production Deployment
1. **Environment Setup**: Configure production environment variables
2. **Database**: Set up PostgreSQL database
3. **Blockchain**: Deploy smart contracts to mainnet/testnet
4. **SSL**: Configure SSL certificates
5. **Monitoring**: Set up logging and monitoring

### Docker Deployment
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose up -d --scale backend=3
```

### Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/
```

## 📈 Monitoring & Logging

### Health Checks
- Application health: `/health`
- Database connectivity
- Blockchain connectivity
- AI model status

### Logging
- Structured logging with JSON format
- Log levels: DEBUG, INFO, WARNING, ERROR
- Centralized logging with ELK stack support

### Metrics
- Request/response times
- Error rates
- AI model performance
- Blockchain transaction status

## 🔧 Configuration

### Environment Variables
See `.env.example` for all available configuration options.

### Key Settings
- `ZEROHACK_DATABASE_URL`: Database connection string
- `ZEROHACK_SECRET_KEY`: JWT secret key
- `ZEROHACK_BLOCKCHAIN_RPC_URL`: Blockchain RPC endpoint
- `ZEROHACK_SMTP_*`: Email configuration

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## 📚 Documentation

- **API Documentation**: Available at `/api/docs` when running
- **Code Documentation**: Inline docstrings and type hints
- **Architecture Diagrams**: See `/docs/architecture/`
- **Deployment Guides**: See `/docs/deployment/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: `/docs/`
- **Email**: support@zerohack.local

## 🔄 Changelog

### v1.0.0 - Enhanced Production Release
- ✅ Centralized API gateway
- ✅ JWT authentication with 2FA
- ✅ Real-time WebSocket updates
- ✅ Backend-driven AI inference
- ✅ Blockchain evidence chain
- ✅ Production-ready deployment
- ✅ Comprehensive security hardening
- ✅ Docker containerization
- ✅ Database integration
- ✅ Notification system

---

**ZeroHack** - Advanced Cybersecurity Platform with AI and Blockchain Integration
