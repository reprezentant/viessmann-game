## Viessmann Game (React + TypeScript + Vite)

Lekka gra przeglądarkowa pokazująca modernizację domu i OZE. Zbieraj zasoby, kupuj urządzenia, stawiaj budynki na izometrycznej mapie, odblokowuj osiągnięcia i śledź postęp w dzienniku. Aplikacja ma tryb dzień/noc oraz dynamiczną pogodę wpływającą na produkcję.

### Zasady gry (Rules)

- Zasoby: ☀️ Słońce, 💧 Woda, 🌬️ Wiatr, 💰 ViCoins.
  - Produkcja zależy od pory dnia (dzień/noc) i pogody.
  - Startowe stawki rosną wraz z rozbudową; ViCoins rosną stale, wzrost może być zwiększany przez efekty.
- Pogoda (losowo, co pewien czas):
  - Chmury ☁️: 0× ☀️
  - Słońce 🌞: 2× ☀️
  - Deszcz 🌧️: 2× 💧
  - Wiatr 🌬️: 2× 🌬️, −50% ☀️, −30% 💧
  - Mróz ❄️: pauza wszystkich produkcji na czas wydarzenia
- Sklep i progresja:
  - Urządzenia (pojedyncze zakupy): węgiel → pellet → gaz → pompa ciepła → inverter/magazyn → grid.
  - Produkcja (wiele sztuk): las, fotowoltaika, e-charger.
  - Zasady stawiania: kocioł węglowy/pellet/gaz tylko na kafelku domu; pozostałe na wolnych kafelkach (dom musi pozostać wolny, jeśli na nim nic nie ma).
  - E-Charger: +5 💰/min (pasywny bonus).
  - Las: silna redukcja zanieczyszczenia (opis w karcie sklepu), działa stale po postawieniu.
- Zanieczyszczenie 🏭:
  - Węgiel podnosi, pellet i las redukują; gaz obniża w stosunku do pelletu.
  - Celem jest ekologiczna modernizacja i ograniczanie emisji.
- Misje:
  - Pierwsze kroki (postaw kocioł węglowy) → +10 ViCoins.
  - Ekologiczny wybór (zamień węgiel na pellet) → −20 zanieczyszczenia.
  - Zielona inwestycja (posadź las) → −30 zanieczyszczenia.
- Osiągnięcia (odblokowują się automatycznie):
  - First Steps: postaw pierwsze urządzenie.
  - Heat Source: posiadaj źródło ciepła.
  - Going Green: zainstaluj OZE.
  - Power Up: zbuduj infrastrukturę (inverter + grid).
- Dziennik (📝) i filtry:
  - Typy wpisów: zakupy, ustawienia (placement), misje, pogoda, osiągnięcia, kamienie milowe.
  - Filtry działają po typie; starsze wpisy są migrowane po tytule.
- Powiadomienia (dzwonek):
  - Toastery pojawiają się przy nowych osiągnięciach, misjach i pogodzie.
  - Każdy toast ma przycisk „✕” do natychmiastowego zamknięcia; auto-zamykanie po kilku sekundach.
- Tryb nocny:
  - Menu profilu, popupy Osiągnięć i Dziennika oraz karty mają ciemne tło i jasne teksty.

### Sterowanie

- Kupno w sklepie wymaga zasobów; po zakupie elementy umieszczaj klikając kafelek na mapie.
- Profil → „Osiągnięcia”/„Dziennik” otwiera odpowiednie popupy; klik na tło zamyka okna.

### Persistencja

Stan gry i profil są zapisywane w localStorage:

- vm_achUnlocked – mapa odblokowanych osiągnięć (timestampy)
- vm_seen_ach, vm_seen_log – znaczniki „ostatnio widziane” (daje czerwone kropki przy nowościach)
- vm_log – wpisy dziennika (z typami)

### Development

- Stack: React + TypeScript + Vite.
- Kod główny: `src/ViessmannGame.tsx` (logika gry, UI, profil, dziennik, toasty, misje, pogoda).

Uruchamianie lokalne (opcjonalne):

```
npm install
npm run dev
```

Build (opcjonalne):

```
npm run build
```

