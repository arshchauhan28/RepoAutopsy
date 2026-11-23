import time
import signal
import logging
from app.db.session import SessionLocal
from app.services.worker_service import run_worker_loop, recover_stale_jobs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("repoautopsy.worker")

running = True


def handle_shutdown(signum, frame):
    global running
    logger.info("Received shutdown signal (%s). Gracefully stopping worker...", signum)
    running = False


def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    logger.info("Starting RepoAutopsy Background Worker with crash recovery...")

    while running:
        db = SessionLocal()
        try:
            processed = run_worker_loop(db, max_jobs=5, lease_timeout_minutes=10)
            if processed > 0:
                logger.info("Worker cycle processed %d job(s)", processed)
        except Exception as e:
            logger.error("Error in worker cycle: %s", e)
        finally:
            db.close()

        # Responsive sleep loop checking running flag
        for _ in range(30):
            if not running:
                break
            time.sleep(0.1)

    logger.info("RepoAutopsy Background Worker cleanly terminated.")


if __name__ == "__main__":
    main()
