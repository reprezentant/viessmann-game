# Viessmann Game

A lightweight browser-based game about home modernization and renewable energy. Collect resources, buy devices, place objects on an isometric map, develop your profile and relationships. Features day/night cycle, dynamic weather, and story events with choices and consequences.

Built with **React** + **TypeScript** + **Vite**.

---

## 🎮 Game Features

### Core Gameplay
- **Resources**: ☀️ Sun, 💧 Water, 🌬️ Wind, ![ViCoin](src/assets/ui/ViCoin_LM.png) ViCoins
  - Production depends on time of day (day/night) and weather conditions
  - Base rates increase with development; ViCoins grow steadily and can be boosted by effects
  
- **Dynamic Weather** (random events):
  - ☁️ Clouds: 0× ☀️ production
  - 🌞 Sunny: 2× ☀️ production
  - 🌧️ Rain: 2× 💧 production
  - 🌬️ Wind: 2× 🌬️, −50% ☀️, −30% 💧
  - ❄️ Frost: pauses all production during event

- **Shop & Progression**:
  - **Devices** (single purchases): Coal → Pellet → Gas → Heat Pump → Inverter/Storage → Grid
  - **Production** (multiple units): Forest, Solar Panels (PV), E-Chargers
  - **Dynamic pricing**:
    - Forest: +8 ☀️ and +8 💧 per owned unit
    - Solar (Vitovolt): ~15% geometric scaling per panel
    - E-Charger: ~18% geometric scaling per unit
  - E-Charger provides +5 ViCoins/min passive bonus
  - Forest: strong pollution reduction

### Environmental System
- **Pollution** 🏭: Coal increases, pellet and forest reduce; gas lowers compared to pellet
- **Eco-Reputation** ⭐: 
  - Score 0–100, calculated as: `100 − smog + min(20, 5×forests)`
  - Affects ViCoins bonus, story events, and faction relationships
  - Tooltip available in header

### Story & Relationships
- **Story Events**: Weighted event selection with cooldowns and conditions (season, smog, eco-reputation, flags)
- **Factions (Relations)**:
  - Community (Mieszkańcy)
  - Suppliers (Dostawcy)
  - Choices affect faction opinions and unlock/block events or bonuses
- **Consequences Examples**:
  - Supplier agreements (pay now or get worse terms)
  - Community protests at low opinion (consultation cost vs smog increase)
  - Press criticism at low eco-reputation (price increase vs expense and smog reduction)

### Missions System
- Right panel shows mission progress bars and rewards
- Mission cards with asset image (left), title/description (right), and reward display
- Completed missions show green border (#7BB894) and check icon
- Examples:
  - First Steps: Place coal boiler → +10 ViCoins
  - Eco Choice: Switch coal to pellet → −20 pollution
  - Green Investment: Plant forest → −30 pollution
- Mission completion doesn't persist between sessions

### Achievements
Auto-unlock achievements:
- **First Steps**: Place first device
- **Heat Source**: Own heating source
- **Going Green**: Install renewable energy
- **Power Up**: Build infrastructure (inverter + grid)

### Journal & Notifications
- **Journal** 📝: Tracks purchases, placements, missions, weather, achievements, milestones
- **Filters**: By entry type
- **Notifications**: Bell icon shows new achievements with red badge
- **Profile**: Red dot indicator for new achievements or journal entries

### UI Features
- **Day/Night Mode**: All panels, popups, and cards adapt with dark/light themes
- **Video Intro**: Loading screen with animated progress bar and background gradient
- **Responsive Cards**: Missions, devices, and production items use warm beige gradient (day) / dark gradient (night)
- **Language Support**: Polish and English with i18n (react-i18next)
- **Unified Styling**: All cards and UI elements use consistent gradient fills and borders

---

## 🎯 Controls

- **Shopping**: Click items in shop (requires resources), then click map tile to place
- **Profile**: Click profile icon → "Achievements"/"Journal" opens respective popups
- **Missions**: Accessible from right panel
- **Cancel Placement**: Press `Esc` key while placing items
- **Settings**: Gear icon for language selection, save/load, new game

---

## 💾 Persistence & Save System

Game state and profile are saved in localStorage:

- `vm_achUnlocked` – Achievement unlock timestamps
- `vm_seen_ach`, `vm_seen_log` – "Last seen" markers (red dots)
- `vm_log` – Journal entries with types
- `vm_save_v2` – Auto-save of core state (tiles, resources, pollution) + v2 metadata
- `vm_eco_hist` – Eco-reputation history (graph in Compendium)
- `vm_story_decisions` – Story decision journal
- `vm_story_flags` – Story flags (unlocks, states)
- `vm_factions` – Faction opinions (Relations)
- `vm_lang` – Language preference ('pl' or 'en')

**Save/Load Features**:
- **Save Game**: Export save to JSON file
- **Load Game**: Import save from JSON file
- **New Game**: Reset state (clears saves, resets map/resources/pollution and "seen" markers)

Note: Mission completion state doesn't persist between sessions.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16+ recommended)
- **npm** or **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/reprezentant/viessmann-game.git
   cd viessmann-game
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```
   
   The app will be available at: **http://localhost:5173/**

4. **Build for production**:
   ```bash
   npm run build
   ```
   
   Production files will be in the `dist/` folder.

---

## 📁 Project Structure

```
viessmann-game/
├── src/
│   ├── assets/
│   │   ├── ui/              # UI icons (day/night variants, ViCoin, badges, etc.)
│   │   ├── missions/        # Mission badge assets
│   │   ├── Intro.mp4        # Video intro
│   │   ├── day_bg.jpg       # Day background
│   │   └── night_bg.jpg     # Night background
│   ├── components/
│   │   ├── MissionCard.tsx  # Individual mission card component
│   │   ├── VideoIntro.tsx   # Video splash screen with loader
│   │   ├── LoadingOverlay.tsx
│   │   ├── StoryModal.tsx   # Story event popup
│   │   └── EventsCenterModal.tsx
│   ├── lib/
│   │   ├── story.ts         # Story engine, events, relations
│   │   ├── economy.ts       # Cost calculations
│   │   └── pollution.ts     # Pollution mechanics
│   ├── locales/
│   │   ├── pl/              # Polish translations
│   │   └── en/              # English translations
│   ├── i18n/
│   │   └── index.ts         # i18next configuration
│   ├── ViessmannGame.tsx    # Main game component
│   ├── App.tsx              # App entry with VideoIntro
│   └── main.tsx             # React entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🛠️ Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite 7.1.3
- **Styling**: Inline CSS-in-JS with theme system
- **Internationalization**: react-i18next
- **Assets**: PNG icons, JPG backgrounds, MP4 video intro

---

## 🎨 Design System

- **Gradients**: 
  - Day: Warm beige `linear-gradient(160deg,#fff3da,#fde2b9,#f7d2a1)`
  - Night: Dark `linear-gradient(160deg,#2f2a3d,#262135,#1d192a)`
- **Borders**: 2px solid with theme-aware colors
- **Typography**: Manrope font family, progressive font-weights (600→700→800→900)
- **Icons**: Dual-theme assets (LM = Light Mode, DM = Dark Mode)
- **Loader**: Unified orange gradient (`#f59e0b → #fb923c → #fbbf24`)

---

## 📝 Development Notes

- **Main Logic**: `src/ViessmannGame.tsx` handles game state, UI, profile, journal, missions, weather
- **Story System**: `src/lib/story.ts` defines events, choices, faction relations, and progression thresholds
- **HMR**: Hot module replacement enabled for fast development
- **Dev Server**: Runs on `localhost:5173` by default

---

## 🌍 Language Support

The game supports:
- 🇵🇱 **Polish** (default)
- 🇬🇧 **English**

Language is auto-detected from browser or can be changed in Settings. Preference is saved in localStorage.

---

## 📄 License

This project is for educational/demonstration purposes.

---

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

---

## 🎯 Roadmap Ideas

- [ ] More story events and branching narratives
- [ ] Additional achievements
- [ ] Extended device tech tree
- [ ] Seasonal graphics variations
- [ ] Multiplayer/leaderboard features

---

**Enjoy building your eco-friendly home!** 🌱🏡
