"""HASS AI Assistant integration — registers pi_agent.ask service."""
import logging

import aiohttp
import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "pi_agent"
ADDON_HOST = "local-pi-agent"
ADDON_PORT = 9199
SERVICE_ASK = "ask"

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)

SERVICE_SCHEMA = vol.Schema(
    {
        vol.Required("question"): cv.string,
        vol.Optional("provider"): cv.string,
        vol.Optional("model"): cv.string,
    }
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up HASS AI Assistant integration."""

    async def handle_ask(call: ServiceCall) -> ServiceResponse:
        """Handle pi_agent.ask service call — returns response if expected."""
        question = call.data["question"]
        provider = call.data.get("provider")
        model = call.data.get("model")
        url = f"http://{ADDON_HOST}:{ADDON_PORT}/ask"

        payload = {"question": question}
        if provider:
            payload["provider"] = provider
        if model:
            payload["model"] = model

        # Check if the service call expects response data
        return_response = getattr(call, "return_response", False)
        if return_response:
            payload["sync"] = True
            timeout_seconds = 90
        else:
            timeout_seconds = 10

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout_seconds),
                ) as resp:
                    if resp.status == 200 and return_response:
                        result = await resp.json()
                        return result
                    elif resp.status == 202:
                        _LOGGER.info("HASS AI Assistant accepted question")
                        return {"status": "accepted"}
                    else:
                        error = await resp.text()
                        _LOGGER.error(
                            "HASS AI Assistant error (%s): %s", resp.status, error
                        )
                        return {"status": "error", "error": error}
        except aiohttp.ClientError as err:
            _LOGGER.error("HASS AI Assistant connection error: %s", err)
            return {"status": "error", "error": str(err)}

    hass.services.async_register(
        DOMAIN,
        SERVICE_ASK,
        handle_ask,
        schema=SERVICE_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )

    _LOGGER.info("HASS AI Assistant service registered")
    return True
