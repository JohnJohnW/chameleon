# Chameleon OSINT Toolkit

A professional, local-first OSINT (Open Source Intelligence) investigation toolkit built with Electron, React, and Python. Designed for investigators, security researchers, and legal professionals.

![Chameleon Banner](public/background.png)

## 🎯 Features

Chameleon includes 8 powerful OSINT tools:

1. **Maigret** - Collect dossiers on individuals by username across 2000+ sites
2. **ExifTool** - Extract comprehensive metadata from images and files
3. **TheHarvester** - Discover emails, subdomains, and hosts from public sources
4. **WHOIS** - Find domain ownership, registration dates, and registrar information
5. **Ollama AI** - Analyze findings with local AI for pattern recognition and insights
6. **Holehe** - Check if emails are registered on 120+ websites
7. **Reverse Image Search** - Search images across Google Lens, Yandex, and TinEye
8. **Geolocation** - Look up IP addresses and coordinates for location intelligence

## ✨ Key Highlights

- **100% Local & Private** - All tools run on your machine, no cloud services required
- **No API Keys** - No external APIs or registrations needed
- **Professional UI** - Clean, minimal interface suitable for legal/corporate use
- **Cross-Platform** - Works on macOS, Linux, and Windows
- **AI-Powered Analysis** - Integrated Ollama for correlating findings
- **Modern Design** - Nintendo Switch-style carousel interface

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.8+
- OSINT tools (auto-installed on first run):
  - maigret
  - exiftool
  - theHarvester
  - holehe
  - whois

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/JohnJohnW/chameleon.git
cd chameleon
```

2. **Install dependencies**
```bash
npm install
cd backend && pip install -r requirements.txt && cd ..
```

3. **Install OSINT tools**
```bash
# macOS/Linux
brew install exiftool whois
pip install maigret holehe theHarvester

# The app will guide you through any missing installations
```

4. **Run the application**
```bash
npm run electron:dev
```

## 📖 Usage

### Running Individual Tools

**Maigret** - Username Intelligence
- Input: Username (e.g., "john_doe")
- Output: Social media profiles, online presence across 2000+ sites
- Use case: Person of interest background checks

**ExifTool** - Metadata Extraction
- Input: Image or file
- Output: GPS coordinates, camera details, timestamps, software used
- Use case: Photo verification, digital forensics

**TheHarvester** - Domain Reconnaissance
- Input: Domain name (e.g., "example.com")
- Output: Email addresses, subdomains, hosts discovered from public sources
- Use case: Corporate intelligence, attack surface mapping

**WHOIS** - Domain Ownership
- Input: Domain name
- Output: Registrant info, registration dates, nameservers, registrar
- Use case: Domain investigations, trademark disputes

**Ollama AI** - Intelligence Analysis
- Input: Findings from other tools or text/images
- Output: Pattern analysis, connections, investigation recommendations
- Use case: Correlating data, finding hidden relationships

**Holehe** - Email Account Discovery
- Input: Email address
- Output: List of sites where email is registered
- Use case: Email intelligence, account enumeration

**Reverse Image Search**
- Input: Image URL or file
- Output: Links to Google Lens, Yandex, and TinEye searches
- Use case: Finding image sources, detecting fakes

**Geolocation**
- Input: IP address or coordinates
- Output: Location data, ISP info, timezone
- Use case: IP intelligence, location verification

### Using Ollama AI

Ollama analyzes findings from other tools to identify patterns and connections.

**Setup:**
1. Install Ollama from https://ollama.com
2. Pull models: `ollama pull llama3.2`
3. Paste results from any tool into Ollama for analysis

## 🏗️ Project Structure

```
chameleon/
├── backend/
│   ├── server.py          # Flask backend for OSINT tools
│   └── requirements.txt   # Python dependencies
├── electron/
│   ├── main.js           # Electron main process
│   └── preload.js        # Electron preload script
├── src/
│   ├── routes/           # Tool components
│   │   ├── Maigret.tsx
│   │   ├── ExifTool.tsx
│   │   ├── TheHarvester.tsx
│   │   ├── Whois.tsx
│   │   ├── Ollama.tsx
│   │   ├── Holehe.tsx
│   │   ├── ReverseImageSearch.tsx
│   │   └── Geolocation.tsx
│   ├── main.tsx          # React router setup
│   └── Splash.tsx        # Landing screen
├── public/               # Static assets
└── package.json         # Node dependencies
```

## 🛠️ Development

```bash
# Run in development mode
npm run electron:dev

# Build for production
npm run build

# Run backend only
cd backend && python server.py

# Run frontend only
npm run dev
```

## 📋 Requirements

### System Requirements
- macOS 10.13+, Linux, or Windows 10+
- 4GB RAM minimum
- 500MB disk space

### Software Dependencies
- Node.js 18+
- Python 3.8+
- Git

### Optional (for full functionality)
- Ollama (for AI analysis)
- Docker (for isolated tool execution)

## 🔒 Privacy & Security

- **100% Local Processing** - All data stays on your machine
- **No Telemetry** - No analytics or tracking
- **No Cloud Services** - No data sent to external servers
- **Open Source** - Audit the code yourself

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with these excellent open-source tools:
- [Maigret](https://github.com/soxoj/maigret)
- [ExifTool](https://exiftool.org/)
- [TheHarvester](https://github.com/laramies/theHarvester)
- [Holehe](https://github.com/megadose/holehe)
- [Ollama](https://ollama.com/)
- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [Flask](https://flask.palletsprojects.com/)

## 📧 Support

For issues, questions, or feature requests, please open an issue on GitHub.

## ⚠️ Legal Disclaimer

This tool is intended for legal, ethical OSINT investigations only. Users are responsible for ensuring their use complies with applicable laws and regulations. Always obtain proper authorization before investigating individuals or organizations.

---

**Made with ❤️ for the OSINT community**
