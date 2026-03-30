# -*- coding: utf-8 -*-
"""
===================================
定时调度模块
===================================

职责：
1. 支持每日定时执行股票分析
2. 支持定时执行大盘复盘
3. 优雅处理信号，确保可靠退出

依赖：
- schedule: 轻量级定时任务库
"""

import logging
import re
import signal
import sys
import time
import threading
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)


class GracefulShutdown:
    """
    优雅退出处理器
    
    捕获 SIGTERM/SIGINT 信号，确保任务完成后再退出
    """
    
    def __init__(self):
        self.shutdown_requested = False
        self._lock = threading.Lock()
        
        # 注册信号处理器
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """信号处理函数"""
        with self._lock:
            if not self.shutdown_requested:
                logger.info(f"收到退出信号 ({signum})，等待当前任务完成...")
                self.shutdown_requested = True
    
    @property
    def should_shutdown(self) -> bool:
        """检查是否应该退出"""
        with self._lock:
            return self.shutdown_requested


class Scheduler:
    """
    定时任务调度器

    基于 schedule 库实现，支持：
    - 每日定时执行
    - 启动时立即执行
    - 优雅退出
    - 动态更新定时时间点
    """

    _TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

    def __init__(
        self,
        schedule_time: str = "18:00",
        schedule_times: Optional[Sequence[str]] = None,
    ):
        """
        初始化调度器

        Args:
            schedule_time: 每日执行时间（兼容参数，格式 "HH:MM"）
            schedule_times: 每日多个执行时间点（HH:MM 列表）
        """
        try:
            import schedule
            self.schedule = schedule
        except ImportError:
            logger.error("schedule 库未安装，请执行: pip install schedule")
            raise ImportError("请安装 schedule 库: pip install schedule")

        self.schedule_times = self._normalize_schedule_times(
            schedule_time=schedule_time,
            schedule_times=schedule_times,
        )
        # 保留兼容字段，供旧代码读取单时间值
        self.schedule_time = self.schedule_times[0]
        self.shutdown_handler = GracefulShutdown()
        self._task_callback: Optional[Callable] = None
        self._background_tasks: List[Dict[str, Any]] = []
        self._running = False
        self._schedule_jobs: List[Any] = []  # 保存定时任务引用，用于动态更新

    @classmethod
    def _normalize_schedule_times(
        cls,
        *,
        schedule_time: Optional[str],
        schedule_times: Optional[Sequence[str]],
    ) -> List[str]:
        candidates: List[str] = []
        invalid: List[str] = []

        if schedule_times:
            for item in schedule_times:
                text = str(item).strip()
                if not text:
                    continue
                candidates.append(text)
        elif schedule_time:
            candidates.append(str(schedule_time).strip())

        valid: List[str] = []
        for item in candidates:
            if cls._TIME_PATTERN.match(item):
                valid.append(item)
            else:
                invalid.append(item)

        if invalid:
            logger.warning("检测到无效定时时间，已忽略: %s", ", ".join(invalid[:5]))

        normalized = sorted(set(valid))
        return normalized or ["18:00"]
        
    def set_daily_task(self, task: Callable, run_immediately: bool = True):
        """
        设置每日定时任务

        Args:
            task: 要执行的任务函数（无参数）
            run_immediately: 是否在设置后立即执行一次
        """
        self._task_callback = task
        self._setup_schedule_jobs()

        if run_immediately:
            logger.info("立即执行一次任务...")
            self._safe_run_task()

    def _setup_schedule_jobs(self):
        """设置定时任务（内部方法）"""
        # 先清除已有的定时任务
        self._clear_schedule_jobs()

        # 设置新的定时任务
        for run_time in self.schedule_times:
            job = self.schedule.every().day.at(run_time).do(self._safe_run_task)
            self._schedule_jobs.append(job)
        logger.info("已设置每日定时任务，执行时间: %s", ", ".join(self.schedule_times))

    def _clear_schedule_jobs(self):
        """清除所有定时任务"""
        for job in self._schedule_jobs:
            try:
                self.schedule.cancel_job(job)
            except Exception:
                pass
        self._schedule_jobs = []

    def update_schedule_times(
        self,
        schedule_time: Optional[str] = None,
        schedule_times: Optional[Sequence[str]] = None,
    ) -> bool:
        """
        动态更新定时任务时间点

        Args:
            schedule_time: 单个执行时间（兼容参数）
            schedule_times: 多个执行时间点列表

        Returns:
            bool: 是否有变化
        """
        new_times = self._normalize_schedule_times(
            schedule_time=schedule_time,
            schedule_times=schedule_times,
        )

        if new_times == self.schedule_times:
            logger.debug("定时时间点无变化: %s", ", ".join(new_times))
            return False

        old_times = self.schedule_times
        self.schedule_times = new_times
        self.schedule_time = new_times[0]

        # 重新设置定时任务
        if self._task_callback is not None:
            self._setup_schedule_jobs()

        logger.info(
            "定时任务时间点已更新: %s -> %s",
            ", ".join(old_times),
            ", ".join(new_times),
        )
        return True
    
    def _safe_run_task(self):
        """安全执行任务（带异常捕获）"""
        if self._task_callback is None:
            return
        
        try:
            logger.info("=" * 50)
            logger.info(f"定时任务开始执行 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info("=" * 50)
            
            self._task_callback()
            
            logger.info(f"定时任务执行完成 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
        except Exception as e:
            logger.exception(f"定时任务执行失败: {e}")

    def add_background_task(
        self,
        task: Callable,
        interval_seconds: int,
        run_immediately: bool = False,
        name: Optional[str] = None,
    ) -> None:
        """Register a periodic background task executed inside the scheduler loop.

        Note: The scheduler loop polls every 30 seconds, so *interval_seconds*
        below 30 will be clamped to 30 to avoid promising unreachable precision.
        """
        clamped_interval = max(30, int(interval_seconds))
        if int(interval_seconds) < 30:
            logger.warning(
                "后台任务 %s 请求间隔 %ds，但调度循环每 30s 轮询一次，已自动调整为 30s",
                name or getattr(task, "__name__", "background_task"),
                interval_seconds,
            )
        entry = {
            "task": task,
            "interval_seconds": clamped_interval,
            "last_run": 0.0,
            "name": name or getattr(task, "__name__", "background_task"),
            "thread": None,
            "running": False,
        }
        if not run_immediately:
            entry["last_run"] = time.time()
        self._background_tasks.append(entry)
        logger.info(
            "已注册后台任务: %s（间隔 %s 秒，立即执行=%s）",
            entry["name"],
            entry["interval_seconds"],
            run_immediately,
        )
        if run_immediately:
            self._start_background_task(entry)

    def _start_background_task(self, entry: Dict[str, Any]) -> bool:
        """Start one background task in a dedicated daemon thread."""
        worker = entry.get("thread")
        if worker is not None and worker.is_alive():
            return False

        def _runner() -> None:
            try:
                logger.info("后台任务开始执行: %s", entry["name"])
                entry["task"]()
            except Exception as exc:
                logger.exception("后台任务执行失败 [%s]: %s", entry["name"], exc)
            finally:
                entry["running"] = False
                entry["thread"] = None

        entry["last_run"] = time.time()
        entry["running"] = True
        worker = threading.Thread(
            target=_runner,
            daemon=True,
            name=f"scheduler-bg-{entry['name']}",
        )
        entry["thread"] = worker
        worker.start()
        return True

    def _run_background_tasks(self) -> None:
        """Execute any background tasks whose interval has elapsed."""
        if not self._background_tasks:
            return

        now = time.time()
        for entry in self._background_tasks:
            worker = entry.get("thread")
            if worker is not None and worker.is_alive():
                continue
            if entry.get("running"):
                entry["running"] = False
                entry["thread"] = None
            if now - entry["last_run"] < entry["interval_seconds"]:
                continue
            self._start_background_task(entry)
    
    def run(self):
        """
        运行调度器主循环
        
        阻塞运行，直到收到退出信号
        """
        self._running = True
        logger.info("调度器开始运行...")
        logger.info(f"下次执行时间: {self._get_next_run_time()}")
        
        while self._running and not self.shutdown_handler.should_shutdown:
            self.schedule.run_pending()
            self._run_background_tasks()
            time.sleep(30)  # 每30秒检查一次
            
            # 每小时打印一次心跳
            if datetime.now().minute == 0 and datetime.now().second < 30:
                logger.info(f"调度器运行中... 下次执行: {self._get_next_run_time()}")
        
        logger.info("调度器已停止")
    
    def _get_next_run_time(self) -> str:
        """获取下次执行时间"""
        jobs = self.schedule.get_jobs()
        if jobs:
            next_run = min(job.next_run for job in jobs)
            return next_run.strftime('%Y-%m-%d %H:%M:%S')
        return "未设置"
    
    def stop(self):
        """停止调度器"""
        self._running = False


def _get_config_schedule_times() -> List[str]:
    """从运行时配置读取当前定时时间点"""
    try:
        from src.config import Config
        config = Config.get_instance()
        times = getattr(config, 'schedule_times', None)
        if times:
            return list(times)
        time_str = getattr(config, 'schedule_time', '18:00')
        return [time_str] if time_str else ['18:00']
    except Exception as e:
        logger.debug("读取配置定时时间失败: %s", e)
        return []


def run_with_schedule(
    task: Callable,
    schedule_time: str = "18:00",
    schedule_times: Optional[Sequence[str]] = None,
    run_immediately: bool = True,
    background_tasks: Optional[List[Dict[str, Any]]] = None,
):
    """
    便捷函数：使用定时调度运行任务

    Args:
        task: 要执行的任务函数
        schedule_time: 每日执行时间（兼容参数）
        schedule_times: 每日多个执行时间点（HH:MM 列表）
        run_immediately: 是否立即执行一次
        background_tasks: 可选的后台任务定义列表。每项为一个字典，
            需包含 `task` 与 `interval_seconds`，可选包含 `name`
            和 `run_immediately`。`interval_seconds` 单位为秒。
    """
    scheduler = Scheduler(schedule_time=schedule_time, schedule_times=schedule_times)

    # 添加配置热更新检查任务（每 60 秒检查一次）
    def check_schedule_config_update():
        current_times = _get_config_schedule_times()
        if current_times:
            scheduler.update_schedule_times(schedule_times=current_times)

    scheduler.add_background_task(
        task=check_schedule_config_update,
        interval_seconds=60,
        run_immediately=False,
        name="schedule_config_watcher",
    )

    for entry in background_tasks or []:
        scheduler.add_background_task(
            task=entry["task"],
            interval_seconds=entry["interval_seconds"],
            run_immediately=entry.get("run_immediately", False),
            name=entry.get("name"),
        )
    scheduler.set_daily_task(task, run_immediately=run_immediately)
    scheduler.run()


if __name__ == "__main__":
    # 测试定时调度
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s',
    )
    
    def test_task():
        print(f"任务执行中... {datetime.now()}")
        time.sleep(2)
        print("任务完成!")
    
    print("启动测试调度器（按 Ctrl+C 退出）")
    run_with_schedule(test_task, schedule_times=["23:59"], run_immediately=True)
