"""
生成 Chrome 插件 popup 界面截图，用于 Word 操作手册。
这里使用 popup-demo.html（复用 popup.css 和 HTML 结构，并填充示例数据）。
"""

import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

CHROME_PATH = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
EXT_DIR = r'C:\Users\darea\WorkBuddy\2026-06-18-09-00-23-distributable\requirement-email-extractor'
DEMO_URL = r'file:///C:/Users/darea/WorkBuddy/2026-06-18-09-00-23-distributable/docs/screenshots/popup-demo.html'
SCREENSHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs', 'screenshots')


def create_driver(load_extension=True):
    chrome_options = Options()
    chrome_options.binary_location = CHROME_PATH
    if load_extension:
        chrome_options.add_argument(f'--load-extension={EXT_DIR}')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--window-size=1280,800')
    chrome_options.add_argument('--hide-scrollbars')
    chrome_options.add_experimental_option('excludeSwitches', ['enable-logging'])
    service = Service()
    return webdriver.Chrome(service=service, options=chrome_options)


def click_tab(driver, tab_name):
    driver.execute_script(
        """
        var tab = document.querySelector('.tab[data-tab="' + arguments[0] + '"]');
        if (tab) tab.click();
        """,
        tab_name
    )


def screenshot_popup(driver, filename):
    path = os.path.join(SCREENSHOT_DIR, filename)
    time.sleep(1)
    popup = driver.find_element(By.CSS_SELECTOR, '.container')
    popup.screenshot(path)
    print(f'截图已保存: {path}')


def screenshot_extensions_page(driver, filename):
    """截取 Chrome 扩展管理页面，展示插件已安装。"""
    path = os.path.join(SCREENSHOT_DIR, filename)
    driver.get('chrome://extensions/')
    time.sleep(2)
    # 开启开发者模式，否则看不到已加载的未打包扩展
    try:
        driver.execute_script("""
            function findDevModeToggle(root) {
                if (!root) return null;
                const toggle = root.querySelector('extensions-toggle-ribbon, cr-toggle, [aria-label*="开发者模式"], [aria-label*="Developer mode"]');
                if (toggle) return toggle;
                const shadows = root.querySelectorAll('*');
                for (const el of shadows) {
                    if (el.shadowRoot) {
                        const found = findDevModeToggle(el.shadowRoot);
                        if (found) return found;
                    }
                }
                return null;
            }
            const toggle = findDevModeToggle(document);
            if (toggle && toggle.getAttribute('aria-pressed') !== 'true' && toggle.getAttribute('checked') !== 'true') {
                toggle.click();
            }
        """)
        time.sleep(2)
    except Exception as e:
        print('启用开发者模式失败:', e)
    driver.save_screenshot(path)
    print(f'截图已保存: {path}')


def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    driver = create_driver(load_extension=True)
    try:
        # 06. 插件安装页面截图
        screenshot_extensions_page(driver, '06_plugin_icon.png')

        # 打开 demo popup 页面
        driver.get(DEMO_URL)
        time.sleep(2)

        # 等待 demo 数据填充完成
        for _ in range(10):
            desc = driver.execute_script("return document.getElementById('field-description').textContent || '';")
            if '支持按角色' in desc:
                break
            time.sleep(0.5)

        # 07. 提取信息标签截图
        screenshot_popup(driver, '07_plugin_extract.png')

        # 08. 收件人管理标签截图
        click_tab(driver, 'contacts')
        driver.execute_script(
            """
            document.getElementById('contact-count').textContent = '3人';
            document.getElementById('contact-source').textContent = '混合';
            var list = document.getElementById('contact-list');
            list.innerHTML = '';
            var contacts = [
                {name: '李四', system: '权限平台', email: 'lisi@company.com', source: '数据库'},
                {name: '王五', system: '基础架构', email: 'wangwu@company.com', source: '数据库'},
                {name: '赵六', system: '安全组', email: 'zhaoliu@company.com', source: '本地'},
            ];
            contacts.forEach(function(c) {
                var row = document.createElement('div');
                row.className = 'contact-item';
                row.innerHTML = '<div class="contact-info"><div class="contact-name">' + c.name + ' <span class="contact-source" style="font-size:11px;background:#e8f0fe;color:#1a73e8;padding:1px 4px;border-radius:4px;">' + c.source + '</span></div><div class="contact-email">' + c.email + '</div><div class="contact-system">' + c.system + '</div></div><div class="contact-actions"><button class="btn-icon" title="编辑">✏️</button><button class="btn-icon" title="删除">🗑️</button></div>';
                list.appendChild(row);
            });
            """
        )
        screenshot_popup(driver, '08_plugin_contacts.png')

        # 09. 邮箱设置标签截图
        click_tab(driver, 'email-settings')
        driver.execute_script(
            """
            document.getElementById('server-status-badge').textContent = '运行中';
            document.getElementById('server-status-badge').style.background = '#d4edda';
            document.getElementById('server-status-badge').style.color = '#155724';
            document.getElementById('smtp-host').value = 'smtp.company.com';
            document.getElementById('smtp-port').value = '465';
            document.getElementById('smtp-user').value = 'noreply@company.com';
            document.getElementById('smtp-pass').value = '********';
            document.getElementById('imap-host').value = 'imap.company.com';
            document.getElementById('imap-port').value = '993';
            document.getElementById('default-cc').value = 'manager@company.com';
            document.getElementById('email-signature').value = '此邮件由需求催办系统自动发送。';
            document.getElementById('db-host').value = '127.0.0.1';
            document.getElementById('db-port').value = '3306';
            document.getElementById('db-name').value = 'workbuddy';
            document.getElementById('db-user').value = 'wb_user';
            document.getElementById('db-pass').value = '********';
            document.getElementById('db-table').value = 'sent_emails';
            """
        )
        screenshot_popup(driver, '09_plugin_settings.png')

    finally:
        driver.quit()


if __name__ == '__main__':
    main()
