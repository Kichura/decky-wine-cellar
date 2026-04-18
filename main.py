import asyncio
import asyncio.subprocess
import logging
import typing

import decky  # type: ignore
from settings import SettingsManager  # type: ignore

PLUGIN_DIR = decky.DECKY_PLUGIN_DIR
PLUGIN_SETTINGS_DIR = decky.DECKY_PLUGIN_SETTINGS_DIR

logger = decky.logger
logger.setLevel(logging.DEBUG)
logger.info("Wine Cellar main.py https://github.com/FlashyReese/decky-wine-cellar")

logger.info('[backend] Settings path: {}'.format(PLUGIN_SETTINGS_DIR))
settings = SettingsManager(name="settings", settings_directory=PLUGIN_SETTINGS_DIR)
settings.read()


class Plugin:
    BACKEND_PATH = f"{PLUGIN_DIR}/bin/backend"
    BACKEND_PROC: typing.Optional[asyncio.subprocess.Process] = None

    @classmethod
    async def _spawn_backend(cls):
        logger.info("Starting Wine Cask (the Wine Cellar backend)...")
        cls.BACKEND_PROC = await asyncio.subprocess.create_subprocess_exec(cls.BACKEND_PATH)
        logger.info(f"Wine Cask started with PID {cls.BACKEND_PROC.pid}")

    @classmethod
    async def _stop_backend(cls):
        if cls.BACKEND_PROC is None:
            logger.warning("Wine Cask is not running!")
            return

        logger.info("Terminating Wine Cask (the Wine Cellar backend)...")
        cls.BACKEND_PROC.terminate()

        try:
            await asyncio.wait_for(cls.BACKEND_PROC.wait(), timeout=5)
        except asyncio.TimeoutError:
            logger.warning("Wine Cask did not exit after SIGTERM, killing process...")
            cls.BACKEND_PROC.kill()
            await cls.BACKEND_PROC.wait()

        cls.BACKEND_PROC = None

    @classmethod
    async def _main(cls):
        if cls.BACKEND_PROC is not None and cls.BACKEND_PROC.returncode is None:
            logger.warning("Wine Cask is already running!")
            return

        await cls._spawn_backend()

    @classmethod
    async def _unload(cls):
        await cls._stop_backend()

    @classmethod
    async def restart_backend(cls):
        await cls._stop_backend()
        await cls._spawn_backend()

    @classmethod
    async def settings_read(cls):
        logger.info('Reading settings')
        return settings.read()

    @classmethod
    async def settings_commit(cls):
        logger.info('Saving settings')
        return settings.commit()

    @classmethod
    async def settings_getSetting(cls, key: str, defaults):
        logger.info('Get {}'.format(key))
        return settings.getSetting(key, defaults)

    @classmethod
    async def settings_setSetting(cls, key: str, value):
        logger.info('Set {}: {}'.format(key, value))
        return settings.setSetting(key, value)
