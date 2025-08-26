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
  - Skalowanie kosztów:
    - Las: każdy kolejny +8 ☀️ i +8 💧 do bazowej ceny.
    - PV (Vitovolt): koszt rośnie geometrycznie o ~15% względem bazowej ceny za każdy posiadany panel.
    - E‑Charger: koszt rośnie geometrycznie o ~18% względem bazowej ceny za każdą posiadaną sztukę.
  - Zasady stawiania: kocioł węglowy/pellet/gaz tylko na kafelku domu; pozostałe na wolnych kafelkach (dom musi pozostać wolny, jeśli na nim nic nie ma).
  - E-Charger: +5 💰/min (pasywny bonus).
  - Las: silna redukcja zanieczyszczenia (opis w karcie sklepu), działa stale po postawieniu.
- Zanieczyszczenie 🏭:
  - Węgiel podnosi, pellet i las redukują; gaz obniża w stosunku do pelletu.
  - Celem jest ekologiczna modernizacja i ograniczanie emisji.
- Misje:
  - Panel „Misje” pokazuje postęp (paski) oraz nagrody.
  - Przykłady: Pierwsze kroki (postaw kocioł węglowy) → +10 ViCoins; Ekologiczny wybór (zamień węgiel na pellet) → −20 zanieczyszczenia; Zielona inwestycja (posadź las) → −30 zanieczyszczenia.
  - Ukończenie misji nie jest zapisywane między sesjami (każda sesja to nowa runda pod kątem misji).
- Osiągnięcia (odblokowują się automatycznie):
  - First Steps: postaw pierwsze urządzenie.
  - Heat Source: posiadaj źródło ciepła.
  - Going Green: zainstaluj OZE.
  - Power Up: zbuduj infrastrukturę (inverter + grid).
- Dziennik (📝) i filtry:
  - Typy wpisów: zakupy, ustawienia (placement), misje, pogoda, osiągnięcia, kamienie milowe.
  - Filtry działają po typie; starsze wpisy są migrowane po tytule.
- Powiadomienia (dzwonek):
  - Toasty pojawiają się tylko przy nowych osiągnięciach.
  - Wpisy dotyczące misji i pogody trafiają do Dziennika bez toastów.
  - Przyciski w prawym górnym rogu: „Mój profil” ma czerwoną kropkę, gdy są nowe osiągnięcia lub wpisy w Dzienniku.
- Tryb nocny:
  - Menu profilu, popupy Osiągnięć i Dziennika oraz karty mają ciemne tło i jasne teksty.

### Sterowanie

- Kupno w sklepie wymaga zasobów; po zakupie elementy umieszczaj klikając kafelek na mapie.
- Profil → „Osiągnięcia”/„Dziennik” otwiera odpowiednie popupy; klik na tło zamyka okna. Panel „Misje” jest dostępny z prawej strony ekranu.
- Podczas ustawiania elementów na mapie można anulować klawiszem Esc.

### Persistencja i zapisy gry

Stan gry i profil są zapisywane w localStorage:

- vm_achUnlocked – mapa odblokowanych osiągnięć (timestampy)
- vm_seen_ach, vm_seen_log – znaczniki „ostatnio widziane” (daje czerwone kropki przy nowościach)
- vm_log – wpisy dziennika (z typami)
- vm_save_v1 – automatyczny zapis rdzenia stanu gry (siatka kafelków, zasoby, zanieczyszczenie)

Zapisy gry:

- „Zapisz grę” – eksportuje zapis do pliku JSON.
- „Wczytaj grę” – importuje zapis z pliku JSON.
- „Nowa gra” – resetuje stan (czyści vm_save_v1, resetuje mapę/zasoby/zanieczyszczenie oraz znaczniki „widziane”).
- Misje: stan ukończenia nie jest utrwalany między sesjami (brak persistencji ukończeń).

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

