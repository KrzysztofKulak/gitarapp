# Gitara: postępy

Statyczna aplikacja do śledzenia nauki gry na gitarze (metal). Vanilla HTML/CSS/JS, bez frameworków, bez kroku build, bez zależności z CDN. Interfejs po polsku, ciemny motyw, mobile-first.

## Uruchomienie lokalnie

Moduły ES nie działają z `file://`, potrzebny jest dowolny serwer statyczny:

```bash
npx serve .
```

albo `python3 -m http.server 8000`, potem otwórz `http://localhost:3000` (serve) lub `http://localhost:8000`.

Testy i weryfikacja akordów (Node 20+):

```bash
npm test
npm run verify-chords
```

## GitHub Pages

1. Wrzuć repo na GitHub.
2. Settings → Pages → Source: branch `main`, folder `/ (root)`.
3. Aplikacja będzie pod `https://<użytkownik>.github.io/<repo>/`.

Wszystkie ścieżki są względne, więc działa też w podkatalogu. Pages serwuje HTTPS, którego wymaga File System Access API.

## Gdzie są dane

Wszystko w jednym pliku JSON (`schemaVersion`, `settings`, `items`, `sessions`). Liczniki ćwiczeń, daty ostatniego ćwiczenia i BPM są wyliczane z `sessions`. Element liczy się najwyżej raz na dzień.

Do statystyk liczy się czas bloku bez rozgrzewki, chyba że wpiszesz minuty ręcznie.

### Przeglądarki

| Przeglądarka | Zapis |
|---|---|
| Chrome, Edge, Opera (komputer) | plik na dysku (File System Access API) |
| Firefox, Safari, przeglądarki na telefonie | tryb awaryjny: `localStorage` + Eksportuj/Importuj JSON |

Przy pierwszym uruchomieniu wybierasz „Utwórz nowy plik postępów” albo „Otwórz istniejący plik”. Uchwyt pliku jest zapamiętany w IndexedDB. Przy kolejnej wizycie przeglądarka zwykle prosi o potwierdzenie dostępu, wtedy wystarczy jeden klik „Połącz z plikiem”. Zapis jest automatyczny, ~500 ms po zmianie; status widać w prawym górnym rogu.

W trybie awaryjnym dane są tylko w `localStorage` tej przeglądarki. Regularnie eksportuj JSON (Ustawienia → Eksportuj JSON).

## Struktura

```
index.html, styles.css, app.js    interfejs i widoki
data/seed.js                      50 akordów i 10 skal (dane startowe)
js/model.js                       model danych, migracje, liczniki z sesji
js/storage.js                     File System Access + IndexedDB + fallback localStorage
js/recommend.js                   rekomendacja kategorii
js/chords.js                      tab akordu, diagram SVG, weryfikacja nut
js/scales.js                      scaleTab(root, intervals, position)
js/stats.js                       seria dni, heatmapa, elementy najdawniej niećwiczone
tools/verify-chords.mjs           weryfikacja listy akordów
tests/                            testy (node --test)
sw.js, manifest.webmanifest       PWA (offline)
```

## Format tabu akordu

6 znaków od niskiej E do wysokiej e, `x` = struna wyciszona, np. `x32010`. Frety od 10 wzwyż: oddziel przecinkami, np. `x,10,12,12,12,10`.

## Generator skal

`scaleTab(root, intervals, position, { high })`: pozycja 1 zaczyna się od tonu podstawowego na strunie E6, kolejne pozycje od kolejnych stopni skali. 3 nuty na strunę dla skal 7-dźwiękowych, 2 (box) dla pentatonik i skali bluesowej, 4 dla 8-dźwiękowej skali zmniejszonej. `high: true` startuje oktawę wyżej (dla E: od 12. progu). Wzór wpisujesz jako `1 ♭3 4 5 ♭7`.
