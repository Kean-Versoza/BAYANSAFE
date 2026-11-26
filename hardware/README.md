# BayanSafe hardware helpers

## Python handler for ESP32 RFID data

`esp32_rfid_handler.py` receives card UIDs from an ESP32 (over USB serial
or over Wi-Fi) and:

* appends them to a CSV log (`rfid_log.csv` by default),
* inserts them into the PostgreSQL `rfid_scans` table, and
* optionally forwards them to the BayanSafe Node server (`/api/rfid/scan`).

### Install

```bash
py -m pip install -r hardware/requirements.txt
```

### Run

List serial ports:

```bash
py hardware/esp32_rfid_handler.py --list-ports
```

Serial mode (ESP32 plugged in by USB):

```bash
py hardware/esp32_rfid_handler.py --port COM3
```

HTTP mode (ESP32 posts over Wi-Fi to this machine):

```bash
py hardware/esp32_rfid_handler.py --http 8090
```

Both at once:

```bash
py hardware/esp32_rfid_handler.py --port COM3 --http 8090
```

### Configuration

Settings are read from environment variables (or `server/.env`):

| Variable            | Default                                            |
| ------------------- | -------------------------------------------------- |
| `DATABASE_URL`      | `postgresql://bayansafe:bayansafe@localhost:5432/bayansafe` |
| `SERVER_URL`        | `http://localhost:3000`                            |
| `RFID_BRIDGE_TOKEN` | (empty)                                            |
| `LOG_FILE`          | `hardware/rfid_log.csv`                            |

Use `--no-db` or `--no-forward` to disable those parts.