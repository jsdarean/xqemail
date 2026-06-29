import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

BASE_URL = 'http://localhost:3000'
USERNAME = 'admin'
PASSWORD = 'changeme'
OUTPUT_DIR = 'docs/screenshots'

os.makedirs(OUTPUT_DIR, exist_ok=True)

chrome_options = Options()
chrome_options.add_argument('--headless=new')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')
chrome_options.add_argument('--window-size=1600,900')
chrome_options.add_argument('--force-device-scale-factor=1.5')

# 使用系统已安装的 Chrome
chrome_options.binary_location = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

service = Service()
driver = webdriver.Chrome(service=service, options=chrome_options)

try:
    wait = WebDriverWait(driver, 10)

    # 1. 登录页截图
    driver.get(f'{BASE_URL}/login.html')
    time.sleep(1)
    driver.save_screenshot(os.path.join(OUTPUT_DIR, '01_login.png'))
    print('已保存 01_login.png')

    # 登录
    driver.find_element(By.ID, 'username').send_keys(USERNAME)
    driver.find_element(By.ID, 'password').send_keys(PASSWORD)
    driver.find_element(By.ID, 'loginBtn').click()

    # 等待跳转到首页
    wait.until(EC.url_contains('/index.html'))
    time.sleep(2)
    driver.save_screenshot(os.path.join(OUTPUT_DIR, '02_index.png'))
    print('已保存 02_index.png')

    # 3. 催办页截图
    driver.get(f'{BASE_URL}/reminder.html')
    wait.until(EC.presence_of_element_located((By.ID, 'tableContainer')))
    time.sleep(2)
    driver.save_screenshot(os.path.join(OUTPUT_DIR, '03_reminder.png'))
    print('已保存 03_reminder.png')

    # 4. 邮箱设置弹窗截图
    driver.get(f'{BASE_URL}/index.html')
    wait.until(EC.presence_of_element_located((By.ID, 'dataTable')))
    time.sleep(1)
    driver.find_element(By.XPATH, "//button[contains(text(),'邮箱设置')]").click()
    wait.until(EC.visibility_of_element_located((By.ID, 'emailConfigModal')))
    time.sleep(1)
    driver.save_screenshot(os.path.join(OUTPUT_DIR, '04_email_config.png'))
    print('已保存 04_email_config.png')

    # 5. 需求详情弹窗截图（点击第一个需求名称）
    driver.get(f'{BASE_URL}/index.html')
    wait.until(EC.presence_of_element_located((By.CLASS_NAME, 'req-name-link')))
    time.sleep(1)
    driver.find_element(By.CLASS_NAME, 'req-name-link').click()
    wait.until(EC.visibility_of_element_located((By.ID, 'detailModal')))
    time.sleep(1)
    driver.save_screenshot(os.path.join(OUTPUT_DIR, '05_detail.png'))
    print('已保存 05_detail.png')

finally:
    driver.quit()

print('所有截图完成')
