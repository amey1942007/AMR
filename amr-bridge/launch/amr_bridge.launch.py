"""ROS 2 launch: start the cloud telemetry bridge beside the robot dashboard.

Include from your Ros_lidar_bot bringup (after the dashboard is up):

    IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([
                FindPackageShare('Ros_lidar_bot'), 'launch', 'amr_bridge.launch.py'
            ])
        ]),
        launch_arguments={'bot_id': 'amr4'}.items(),
    )

Or run standalone:

    ros2 launch amr_bridge amr_bridge.launch.py bot_id:=amr4

Env file (required on the Pi): /etc/amr-bridge.env  — see amr-bridge/.env.pi.example
Copy this launch file into Ros_lidar_bot/launch/ (or install via the share layout below).
"""

from __future__ import annotations

import os
from pathlib import Path

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, LogInfo, OpaqueFunction
from launch.substitutions import LaunchConfiguration


def _load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _launch_bridge(context, *args, **kwargs):
    bot_id = LaunchConfiguration("bot_id").perform(context)
    env_file = LaunchConfiguration("env_file").perform(context)
    dashboard = LaunchConfiguration("dashboard").perform(context)
    python_exe = LaunchConfiguration("python").perform(context)

    file_env = _load_env_file(Path(env_file).expanduser())
    env = {**os.environ, **file_env}
    env["AMR_BOT_ID"] = bot_id or env.get("AMR_BOT_ID", "amr4")
    if dashboard:
        env["AMR_DASHBOARD_URL"] = dashboard

    missing = [k for k in ("AMR_SUPABASE_URL", "AMR_SUPABASE_KEY", "AMR_BRIDGE_TOKEN") if not env.get(k)]
    # Back-compat: service role still works if set instead of KEY+TOKEN
    if missing and not env.get("AMR_SUPABASE_SERVICE_KEY"):
        return [
            LogInfo(msg=f"[amr_bridge] missing env {missing} — put them in {env_file}"),
        ]

    # Prefer installed module; fall back to repo checkout next to the workspace.
    cmd = [python_exe, "-m", "amr_telemetry_bridge"]
    return [
        LogInfo(msg=f"[amr_bridge] starting bot_id={env['AMR_BOT_ID']} env_file={env_file}"),
        ExecuteProcess(
            cmd=cmd,
            name="amr_telemetry_bridge",
            output="screen",
            additional_env=env,
            respawn=True,
            respawn_delay=3.0,
        ),
    ]


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument("bot_id", default_value="amr4",
                              description="amr4 | hardware-bot"),
        DeclareLaunchArgument("env_file", default_value="/etc/amr-bridge.env",
                              description="Path to Pi secrets env file"),
        DeclareLaunchArgument("dashboard", default_value="http://127.0.0.1:8080",
                              description="Local robot_dashboard_node HTTP base"),
        DeclareLaunchArgument("python", default_value="python3",
                              description="Python used for the bridge venv/system"),
        OpaqueFunction(function=_launch_bridge),
    ])
