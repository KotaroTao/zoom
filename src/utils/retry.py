"""Retry utilities with exponential backoff."""

import asyncio
import functools
from dataclasses import dataclass
from typing import Callable, Optional, Tuple, Type, Union

from src.utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""

    max_attempts: int = 3
    initial_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    exceptions: Tuple[Type[Exception], ...] = (Exception,)


def async_retry(
    config: Optional[RetryConfig] = None,
    max_attempts: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    """
    Decorator for async functions with exponential backoff retry.

    Args:
        config: RetryConfig object (takes precedence over other args)
        max_attempts: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff
        exceptions: Tuple of exception types to catch

    Usage:
        @async_retry(max_attempts=3, initial_delay=1.0)
        async def my_api_call():
            ...
    """
    if config:
        max_attempts = config.max_attempts
        initial_delay = config.initial_delay
        max_delay = config.max_delay
        exponential_base = config.exponential_base
        exceptions = config.exceptions

    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            delay = initial_delay

            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_attempts:
                        logger.error(
                            f"Function {func.__name__} failed after {max_attempts} attempts: {e}"
                        )
                        raise

                    logger.warning(
                        f"Function {func.__name__} attempt {attempt}/{max_attempts} "
                        f"failed: {e}. Retrying in {delay:.1f}s..."
                    )

                    await asyncio.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)

            raise last_exception

        return wrapper

    return decorator


class RetryableError(Exception):
    """Exception that indicates the operation should be retried."""

    pass


class NonRetryableError(Exception):
    """Exception that indicates the operation should NOT be retried."""

    pass
