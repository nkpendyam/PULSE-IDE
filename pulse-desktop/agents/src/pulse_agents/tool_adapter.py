"""
PULSE Tool Adapter - Standardized interface for tool execution
"""

import asyncio
import subprocess
import shutil
import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import logging

logger = logging.getLogger(__name__)


class ToolType(str, Enum):
    """Tool types"""
    COMPILER = "compiler"
    LINTER = "linter"
    TEST_RUNNER = "test_runner"
    FORMATTER = "formatter"
    GIT = "git"
    FILESYSTEM = "filesystem"
    NETWORK = "network"
    CUSTOM = "custom"


@dataclass
class ToolResult:
    """Result from tool execution"""
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    output_files: List[str]
    metadata: Dict[str, Any]


class ToolAdapter:
    """
    Standardized adapter for tool execution
    
    Provides a unified interface for calling compilers, test runners,
    linters, git, and other OS tools with sandboxing support.
    """
    
    def __init__(
        self,
        working_dir: Optional[Path] = None,
        timeout_seconds: int = 300,
        env: Optional[Dict[str, str]] = None,
    ):
        self.working_dir = working_dir or Path.cwd()
        self.timeout_seconds = timeout_seconds
        self.env = env or {}
        self._tools: Dict[str, Dict] = {}
        
        self._register_default_tools()
    
    def _register_default_tools(self):
        """Register default tools"""
        # Git
        self._tools["git"] = {
            "executable": "git",
            "type": ToolType.GIT,
            "description": "Version control",
        }
        
        # Python
        if shutil.which("python") or shutil.which("python3"):
            self._tools["python"] = {
                "executable": shutil.which("python") or shutil.which("python3"),
                "type": ToolType.COMPILER,
                "description": "Python interpreter",
            }
            self._tools["pytest"] = {
                "executable": shutil.which("pytest") or "pytest",
                "type": ToolType.TEST_RUNNER,
                "description": "Python test runner",
            }
            self._tools["black"] = {
                "executable": shutil.which("black") or "black",
                "type": ToolType.FORMATTER,
                "description": "Python code formatter",
            }
            self._tools["ruff"] = {
                "executable": shutil.which("ruff") or "ruff",
                "type": ToolType.LINTER,
                "description": "Python linter",
            }
            self._tools["mypy"] = {
                "executable": shutil.which("mypy") or "mypy",
                "type": ToolType.LINTER,
                "description": "Python type checker",
            }
        
        # Node.js
        if shutil.which("node"):
            self._tools["node"] = {
                "executable": "node",
                "type": ToolType.COMPILER,
                "description": "Node.js runtime",
            }
            self._tools["npm"] = {
                "executable": "npm",
                "type": ToolType.COMPILER,
                "description": "Node package manager",
            }
        
        # Rust
        if shutil.which("cargo"):
            self._tools["cargo"] = {
                "executable": "cargo",
                "type": ToolType.COMPILER,
                "description": "Rust package manager",
            }
            self._tools["rustc"] = {
                "executable": "rustc",
                "type": ToolType.COMPILER,
                "description": "Rust compiler",
            }
    
    def register_tool(
        self,
        name: str,
        executable: str,
        tool_type: ToolType,
        description: str = "",
    ):
        """Register a custom tool"""
        self._tools[name] = {
            "executable": executable,
            "type": tool_type,
            "description": description,
        }
        logger.info(f"Registered tool: {name}")
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """List all registered tools"""
        return [
            {"name": name, **info}
            for name, info in self._tools.items()
        ]
    
    async def execute(
        self,
        tool: str,
        args: List[str] = None,
        input_data: Optional[str] = None,
        cwd: Optional[Path] = None,
        timeout: Optional[int] = None,
        capture_output: bool = True,
    ) -> ToolResult:
        """
        Execute a tool with arguments
        
        Args:
            tool: Tool name
            args: Command line arguments
            input_data: stdin input
            cwd: Working directory
            timeout: Timeout in seconds
            capture_output: Whether to capture stdout/stderr
        
        Returns:
            ToolResult with execution outcome
        """
        if tool not in self._tools:
            raise ValueError(f"Unknown tool: {tool}")
        
        tool_info = self._tools[tool]
        executable = tool_info["executable"]
        args = args or []
        cwd = cwd or self.working_dir
        timeout = timeout or self.timeout_seconds
        
        # Build command
        cmd = [executable] + args
        
        # Build environment
        env = os.environ.copy()
        env.update(self.env)
        
        logger.debug(f"Executing: {' '.join(cmd)}")
        
        import time
        start_time = time.time()
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE if input_data else None,
                stdout=asyncio.subprocess.PIPE if capture_output else None,
                stderr=asyncio.subprocess.PIPE if capture_output else None,
                cwd=str(cwd),
                env=env,
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(input=input_data.encode() if input_data else None),
                timeout=timeout,
            )
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            return ToolResult(
                success=process.returncode == 0,
                exit_code=process.returncode,
                stdout=stdout.decode() if stdout else "",
                stderr=stderr.decode() if stderr else "",
                duration_ms=duration_ms,
                output_files=[],
                metadata={},
            )
            
        except asyncio.TimeoutError:
            duration_ms = int((time.time() - start_time) * 1000)
            return ToolResult(
                success=False,
                exit_code=-1,
                stdout="",
                stderr=f"Tool execution timed out after {timeout} seconds",
                duration_ms=duration_ms,
                output_files=[],
                metadata={"timeout": True},
            )
            
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Tool execution failed: {e}")
            return ToolResult(
                success=False,
                exit_code=-1,
                stdout="",
                stderr=str(e),
                duration_ms=duration_ms,
                output_files=[],
                metadata={"error": str(e)},
            )
    
    async def run_tests(
        self,
        test_path: Path,
        framework: str = "pytest",
        extra_args: List[str] = None,
    ) -> ToolResult:
        """Run tests"""
        if framework == "pytest":
            args = ["-v", str(test_path)]
            if extra_args:
                args.extend(extra_args)
            return await self.execute("pytest", args)
        else:
            raise ValueError(f"Unsupported test framework: {framework}")
    
    async def run_linter(
        self,
        path: Path,
        linter: str = "ruff",
        fix: bool = False,
    ) -> ToolResult:
        """Run a linter"""
        if linter == "ruff":
            args = ["check", str(path)]
            if fix:
                args.append("--fix")
            return await self.execute("ruff", args)
        elif linter == "mypy":
            args = [str(path)]
            return await self.execute("mypy", args)
        else:
            raise ValueError(f"Unsupported linter: {linter}")
    
    async def run_formatter(
        self,
        path: Path,
        formatter: str = "black",
        check_only: bool = False,
    ) -> ToolResult:
        """Run a formatter"""
        if formatter == "black":
            args = [str(path)]
            if check_only:
                args.append("--check")
            return await self.execute("black", args)
        else:
            raise ValueError(f"Unsupported formatter: {formatter}")
    
    async def git_status(self, repo_path: Path) -> ToolResult:
        """Get git status"""
        return await self.execute("git", ["status", "--porcelain"], cwd=repo_path)
    
    async def git_diff(self, repo_path: Path, staged: bool = False) -> ToolResult:
        """Get git diff"""
        args = ["diff"]
        if staged:
            args.append("--staged")
        return await self.execute("git", args, cwd=repo_path)
    
    async def git_commit(
        self,
        repo_path: Path,
        message: str,
        add_all: bool = False,
    ) -> ToolResult:
        """Create a git commit"""
        if add_all:
            await self.execute("git", ["add", "-A"], cwd=repo_path)
        return await self.execute("git", ["commit", "-m", message], cwd=repo_path)
