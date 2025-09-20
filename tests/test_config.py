"""配置管理测试模块。"""

import tempfile
import pytest
from pathlib import Path

from ayu_dit.config.settings import ConfigManager


class TestConfigManager:
    """配置管理器测试类。"""
    
    def test_load_default_config(self):
        """测试加载默认配置。"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "test_config.yaml"
            config_manager = ConfigManager(str(config_path))
            
            config = config_manager.load_config()
            
            # 验证默认配置结构
            assert 'application' in config
            assert 'workflow' in config
            assert 'resolve' in config
            assert 'lut' in config
            assert 'proxy' in config
            assert 'report' in config
            assert 'ipc' in config
            
            # 验证默认值
            assert config['application']['language'] == 'zh_CN'
            assert config['application']['log_level'] == 'INFO'
            assert config['resolve']['auto_launch'] is True
            assert config['proxy']['enabled'] is True
    
    def test_save_and_load_config(self):
        """测试保存和加载配置。"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "test_config.yaml"
            config_manager = ConfigManager(str(config_path))
            
            # 创建测试配置
            test_config = {
                'application': {
                    'language': 'en_US',
                    'log_level': 'DEBUG'
                },
                'workflow': {
                    'backup_locations': ['/test/backup1', '/test/backup2']
                },
                'resolve': {
                    'auto_launch': False,
                    'project_template': 'custom'
                },
                'lut': {
                    'library_path': '/test/luts',
                    'auto_apply': False
                },
                'proxy': {
                    'enabled': False,
                    'resolution_threshold': [3840, 2160],
                    'codec': 'DNxHD'
                },
                'report': {
                    'template': 'custom',
                    'auto_open': False
                },
                'ipc': {
                    'host': '127.0.0.1',
                    'port': 8888
                }
            }
            
            # 保存配置
            assert config_manager.save_config(test_config) is True
            
            # 重新加载配置
            loaded_config = config_manager.load_config()
            
            # 验证配置正确保存和加载
            assert loaded_config['application']['language'] == 'en_US'
            assert loaded_config['application']['log_level'] == 'DEBUG'
            assert loaded_config['workflow']['backup_locations'] == ['/test/backup1', '/test/backup2']
            assert loaded_config['resolve']['auto_launch'] is False
            assert loaded_config['proxy']['enabled'] is False
            assert loaded_config['ipc']['port'] == 8888
    
    def test_update_config(self):
        """测试更新配置。"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config_path = Path(temp_dir) / "test_config.yaml"
            config_manager = ConfigManager(str(config_path))
            
            # 加载默认配置
            config_manager.load_config()
            
            # 更新部分配置
            updates = {
                'application': {
                    'language': 'en_US'
                },
                'proxy': {
                    'enabled': False
                }
            }
            
            assert config_manager.update_config(updates) is True
            
            # 验证更新结果
            updated_config = config_manager.get_config()
            assert updated_config['application']['language'] == 'en_US'
            assert updated_config['application']['log_level'] == 'INFO'  # 保持原值
            assert updated_config['proxy']['enabled'] is False
            assert updated_config['proxy']['codec'] == 'ProRes Proxy'  # 保持原值