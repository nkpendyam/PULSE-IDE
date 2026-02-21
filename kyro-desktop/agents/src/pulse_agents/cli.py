"""
PULSE Agent CLI - Command line interface for running agents
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path

from .agent import Agent, AgentType, AgentConfig
from .kernel_client import KernelClient
from .tool_adapter import ToolAdapter
from .context_manager import ContextManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(
        description="PULSE Agent Runtime",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    # Run agent
    run_parser = subparsers.add_parser("run", help="Run an agent")
    run_parser.add_argument("name", help="Agent name")
    run_parser.add_argument(
        "--type",
        choices=["reactive", "deliberative", "hybrid"],
        default="hybrid",
        help="Agent type",
    )
    run_parser.add_argument(
        "--kernel",
        default="ws://localhost:9876",
        help="Kernel WebSocket URL",
    )
    run_parser.add_argument(
        "--http",
        default="http://localhost:8080",
        help="Kernel HTTP URL",
    )
    run_parser.add_argument(
        "--max-tasks",
        type=int,
        default=1,
        help="Maximum concurrent tasks",
    )
    run_parser.add_argument(
        "--heartbeat",
        type=int,
        default=30,
        help="Heartbeat interval in seconds",
    )
    run_parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Task timeout in seconds",
    )
    
    # List tools
    tools_parser = subparsers.add_parser("tools", help="List available tools")
    tools_parser.add_argument(
        "--cwd",
        type=Path,
        help="Working directory",
    )
    
    # Test connection
    test_parser = subparsers.add_parser("test", help="Test kernel connection")
    test_parser.add_argument(
        "--kernel",
        default="ws://localhost:9876",
        help="Kernel WebSocket URL",
    )
    
    args = parser.parse_args()
    
    if args.command == "run":
        asyncio.run(run_agent(args))
    elif args.command == "tools":
        list_tools(args)
    elif args.command == "test":
        asyncio.run(test_connection(args))
    else:
        parser.print_help()
        sys.exit(1)


async def run_agent(args):
    """Run an agent"""
    logger.info(f"Starting agent: {args.name}")
    
    # Create kernel client
    client = KernelClient(
        kernel_url=args.kernel,
        http_url=args.http,
    )
    
    try:
        await client.connect()
        logger.info("Connected to kernel")
        
        # Create agent config
        config = AgentConfig(
            max_concurrent_tasks=args.max_tasks,
            heartbeat_interval_ms=args.heartbeat * 1000,
            task_timeout_ms=args.timeout * 1000,
        )
        
        # Create agent
        agent_type = {
            "reactive": AgentType.REACTIVE,
            "deliberative": AgentType.DELIBERATIVE,
            "hybrid": AgentType.HYBRID,
        }[args.type]
        
        agent = Agent(
            name=args.name,
            agent_type=agent_type,
            config=config,
            kernel_client=client,
        )
        
        # Register sample handlers
        async def handle_code_review(task):
            logger.info(f"Reviewing code: {task.payload.get('path')}")
            return {"review": "Code looks good!", "issues": []}
        
        async def handle_test_run(task):
            logger.info(f"Running tests: {task.payload.get('path')}")
            tool = ToolAdapter()
            result = await tool.run_tests(Path(task.payload.get("path", ".")))
            return {
                "success": result.success,
                "output": result.stdout,
                "errors": result.stderr,
            }
        
        agent.register_handler("code_review", handle_code_review)
        agent.register_handler("test_run", handle_test_run)
        
        # Start agent
        await agent.start()
        
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)
    finally:
        await client.disconnect()


def list_tools(args):
    """List available tools"""
    cwd = args.cwd or Path.cwd()
    tool_adapter = ToolAdapter(working_dir=cwd)
    
    print("\nAvailable Tools:")
    print("-" * 50)
    
    for tool in tool_adapter.list_tools():
        print(f"  {tool['name']}: {tool.get('description', 'No description')}")
    
    print()


async def test_connection(args):
    """Test kernel connection"""
    logger.info(f"Testing connection to {args.kernel}")
    
    client = KernelClient(kernel_url=args.kernel)
    
    try:
        await client.connect()
        status = await client.get_status()
        
        print("\nKernel Status:")
        print("-" * 50)
        print(f"  State: {status.get('state')}")
        print(f"  Version: {status.get('version')}")
        print(f"  Uptime: {status.get('uptime_secs')}s")
        print(f"  Policy Mode: {status.get('policy_mode')}")
        print("\nConnection successful!")
        
    except Exception as e:
        print(f"\nConnection failed: {e}")
        sys.exit(1)
    finally:
        await client.disconnect()


if __name__ == "__main__":
    main()
