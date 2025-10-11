# Chameleon Desktop

A modern, beautiful React desktop application starter template built with Electron, React, TypeScript, and Vite.

## ✨ Features

- ⚡ **Lightning Fast** - Built with Vite for instant HMR and optimised builds
- 🎨 **Modern UI** - Beautiful, responsive interface with smooth animations
- 🔒 **Secure** - Context isolation and secure IPC communication
- 🚀 **Cross-Platform** - Build for macOS, Windows, and Linux
- 📦 **TypeScript** - Full type safety and excellent developer experience
- 🔧 **Production Ready** - Complete build and distribution configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Git

### Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Start development server:**

```bash
npm run electron:dev
```

This will start the Vite dev server and launch the Electron app with hot module replacement enabled.

## 📝 Available Scripts

- `npm run dev` - Start Vite dev server only
- `npm run electron:dev` - Start both Vite dev server and Electron app
- `npm run build` - Build and package the application
- `npm run electron:build` - Build the application for distribution
- `npm run preview` - Preview the production build

## 🏗️ Project Structure

```
chameleon/
├── electron/              # Electron main process files
│   ├── main.ts           # Main process entry point
│   └── preload.ts        # Preload script for IPC
├── src/                  # React application source
│   ├── App.tsx           # Main React component
│   ├── App.css           # Component styles
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html            # HTML template
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## 🔧 Configuration

### Electron Builder

The application is configured to build for multiple platforms. Edit the `build` section in `package.json` to customise:

- **macOS**: DMG and ZIP formats
- **Windows**: NSIS installer and portable executable
- **Linux**: AppImage and DEB package

### Vite Configuration

Customise the Vite build process in `vite.config.ts`. The current setup includes:

- React plugin with Fast Refresh
- Electron plugin for main and preload processes
- Electron renderer plugin for Node.js integration

## 📡 IPC Communication

The template includes secure IPC communication between the main and renderer processes:

### Main Process → Renderer

```typescript
// In electron/main.ts
win?.webContents.send('main-process-message', data)
```

### Renderer → Main Process

```typescript
// In your React component
window.electronAPI.receive('main-process-message', (data) => {
  console.log(data)
})
```

### Extend IPC Channels

Add new IPC channels in `electron/preload.ts`:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // Add your custom methods here
  myCustomMethod: () => ipcRenderer.invoke('my-channel'),
})
```

## 🎨 Customising the UI

### Colours

Edit CSS variables in `src/index.css`:

```css
:root {
  --primary-color: #6366f1;
  --primary-hover: #4f46e5;
  /* Add more custom colours */
}
```

### Components

The template includes ready-to-use components:

- Sidebar navigation
- Header with action buttons
- Card layouts
- Button styles (primary, secondary, outline)
- Interactive counter demo

## 📦 Building for Production

### Build for Current Platform

```bash
npm run electron:build
```

### Build for Specific Platform

```bash
# macOS
npm run electron:build -- --mac

# Windows
npm run electron:build -- --win

# Linux
npm run electron:build -- --linux
```

The built applications will be in the `release/` directory.

## 🔨 Development Tips

1. **Hot Module Replacement**: Changes to React components will hot-reload automatically
2. **DevTools**: Development builds open DevTools automatically
3. **Type Safety**: Use TypeScript for better code quality and autocomplete
4. **ESLint**: Add ESLint for code linting (not included by default)

## 🐛 Troubleshooting

### Port Already in Use

If port 5173 is already in use, change it in `vite.config.ts`:

```typescript
server: {
  port: 3000, // Change to your preferred port
}
```

### Build Fails

Make sure you have the latest dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Electron Won't Start

Check that the main process file is built correctly:

```bash
npm run dev
```

Then in a separate terminal:

```bash
electron .
```

## 📚 Learn More

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

## 📄 Licence

MIT Licence - feel free to use this template for your projects!

## 🤝 Contributing

This is a starter template. Fork it, customise it, and make it your own!

---

**Happy Building! 🚀**

