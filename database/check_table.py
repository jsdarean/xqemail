import os
import sys

try:
    import pymysql
except ImportError:
    print("[错误] 需要安装 pymysql：pip install pymysql")
    sys.exit(1)


def load_env(env_path):
    """从 .env 文件加载环境变量"""
    if not os.path.exists(env_path):
        print(f"[错误] 未找到环境变量文件：{env_path}")
        print("请复制 email-manager/.env.example 为 email-manager/.env 并填写配置")
        sys.exit(1)

    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip())


base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, '..', 'email-manager', '.env')
load_env(env_path)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'aicoding'),
    'charset': os.getenv('DB_CHARSET', 'utf8mb4')
}

if not DB_CONFIG['password']:
    print("[错误] 未配置 DB_PASSWORD，请在 .env 中设置")
    sys.exit(1)


def main():
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cursor:
            print("=== 表结构 ===")
            cursor.execute("DESCRIBE sent_emails")
            columns = cursor.fetchall()
            for col in columns:
                print(col)

            print("\n=== 前5条数据样本 ===")
            cursor.execute("SELECT * FROM sent_emails LIMIT 5")
            rows = cursor.fetchall()
            for row in rows:
                print(row)

            print("\n=== 总记录数 ===")
            cursor.execute("SELECT COUNT(*) FROM sent_emails")
            count = cursor.fetchone()
            print(f"总记录数: {count[0]}")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
