import os
import sys

try:
    import pythoncom
    from win32com.client import Dispatch
except ImportError:
    print("[错误] 需要安装 pywin32：pip install pywin32")
    sys.exit(1)

# 获取当前脚本所在目录
base_dir = os.path.dirname(os.path.abspath(__file__))
start_bat = os.path.join(base_dir, 'start-server.bat')

if not os.path.exists(start_bat):
    print(f"[错误] 未找到启动脚本：{start_bat}")
    sys.exit(1)

desktop = os.path.join(os.path.expanduser("~"), "Desktop")
shortcut_path = os.path.join(desktop, "需求催办系统.lnk")

shell = Dispatch('WScript.Shell')
shortcut = shell.CreateShortcut(shortcut_path)
shortcut.TargetPath = start_bat
shortcut.WorkingDirectory = base_dir
shortcut.Description = "启动需求催办系统服务器"
shortcut.IconLocation = start_bat
shortcut.Save()

print(f"✅ 桌面快捷方式已创建：{shortcut_path}")
