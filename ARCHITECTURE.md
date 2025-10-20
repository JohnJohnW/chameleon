# Chameleon Architecture - Console-Style OSINT Suite

## Overview
Chameleon now features a **Nintendo Switch/PS5-style home screen** where you select OSINT tools like games. Each tool has its own unique interface and branding.

## Application Flow

```
┌─────────────┐
│   Splash    │  Landing page with "find yourself before others do"
│   Screen    │  
└──────┬──────┘
       │
       ├─ No input → Home Screen (Console-style tool selector)
       └─ With input → Sherlock Tool (Direct scan)
       
┌─────────────┐
│    Home     │  Console-style OSINT tool selector
│   Screen    │  - Shows all available tools as cards
│             │  - Nintendo/PS5 inspired UI
└──────┬──────┘
       │
       └─ Select Tool → Tool-specific interface

┌─────────────┐
│  Sherlock   │  Dark-themed Sherlock interface
│    Tool     │  - Green/detective theme
│             │  - Sherlock-specific branding
│             │  - Username scanning
└─────────────┘
```

## Routes

- `/` - Splash screen (landing page)
- `/home` - Console-style home screen with tool selection
- `/sherlock` - Sherlock OSINT tool interface
- `/sherlock?query=username` - Direct Sherlock scan with username
- `/scan` - (Legacy) Redirects to `/sherlock`

## New Files

### Home Screen
- `src/routes/Home.tsx` - Console-style tool selector component
- `src/routes/Home.css` - Styling for the home screen

### Sherlock Tool
- `src/routes/SherlockTool.tsx` - Sherlock-specific interface
- `src/routes/SherlockTool.css` - Dark theme with Sherlock branding

## Tool Structure

Each OSINT tool should have:
1. **Unique branding** - Own logo, colors, and theme
2. **Dedicated route** - `/toolname`
3. **Tool-specific interface** - Custom UI tailored to the tool's purpose
4. **Entry in Home.tsx** - Card in the tool selector

### Example: Adding a New Tool

```typescript
// In src/routes/Home.tsx, add to OSINT_TOOLS array:
{
  id: 'maltego',
  name: 'Maltego',
  description: 'Link analysis for investigations',
  icon: '🕸️',
  color: '#2d3748',
  route: '/maltego'
}
```

Then create:
- `src/routes/MaltegoTool.tsx`
- `src/routes/MaltegoTool.css`
- Add route in `src/main.tsx`

## Current Tools

### Sherlock
- **Theme**: Dark green detective aesthetic
- **Purpose**: Hunt social media accounts by username
- **Features**: 
  - Real-time scanning across 400+ platforms
  - Results with severity indicators
  - CSV export via backend
  - Dark theme with green accents (#7ee787)

## Design Philosophy

1. **Console Experience**: Each tool feels like launching a game
2. **Tool Autonomy**: Each tool has complete control over its interface
3. **Unified Navigation**: Easy return to home screen
4. **Scalability**: Simple to add new OSINT tools

## Theming

### Chameleon Global
- Background: Gradient dark blue/purple
- Logo: Chameleon icon
- Font: Avenir Next / Segoe UI

### Sherlock Specific
- Background: Dark (#0d1117)
- Primary Color: Green (#7ee787)
- Accent: Dark green (#1a472a)
- Icon: 🔍

## Backend Integration

Server runs on `http://localhost:41234`:
- `POST /scan` - Start Sherlock scan
- `GET /stream/:jobId` - SSE stream for results

Sherlock binary path (Mac): `/Library/Frameworks/Python.framework/Versions/3.13/bin/sherlock`

## Running the Application

1. **Start backend server**:
   ```bash
   cd server
   npm start
   ```

2. **Start frontend dev server**:
   ```bash
   npm run dev
   ```

3. **Navigate to**: `http://localhost:5173`

## Mac-Specific Configuration

The server is configured for Mac with Sherlock installed via pip:
- Python 3.13 framework installation
- Sherlock binary in Python framework bin directory
- CSV output to temporary directories in `/tmp`

## Future Enhancements

- Add more OSINT tools (Maltego, SpiderFoot, theHarvester, etc.)
- Tool favorites/recently used
- Keyboard navigation in home screen
- Tool categories/filtering
- Dark/light mode toggle per tool




