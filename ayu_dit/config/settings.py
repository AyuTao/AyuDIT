"""配置管理模块。

提供YAML配置文件的加载、验证和管理功能。
"""

import os
from pathlib import Path
from typing import Any, Dict, Optional

import yaml
from cerberus import Validator

from ayu_dit.config.constants import (
    DEFAULT_BACKUP_LOCATIONS,
    DEFAULT_CONFIG_DIR,
    DEFAULT_CONFIG_FILE,
    DEFAULT_IPC_HOST,
    DEFAULT_IPC_PORT,
    DEFAULT_LANGUAGE,
    DEFAULT_LOG_LEVEL,
    DEFAULT_PROXY_CODEC,
    DEFAULT_PROXY_RESOLUTION_THRESHOLD,
    SUPPORTED_LANGUAGES,
)
from ayu_dit.utils.logger import get_logger


class ConfigManager:
    """配置管理器类。
    
    负责加载、验证和管理应用程序配置。
    """
    
    # 配置验证模式
    CONFIG_SCHEMA = {
        'application': {
            'type': 'dict',
            'schema': {
                'language': {
                    'type': 'string',
                    'allowed': list(SUPPORTED_LANGUAGES),
                    'default': DEFAULT_LANGUAGE
                },
                'log_level': {
                    'type': 'string',
                    'allowed': ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                    'default': DEFAULT_LOG_LEVEL
                }
            }
        },
        'workflow': {
            'type': 'dict',
            'schema': {
                'backup_locations': {
                    'type': 'list',
                    'schema': {'type': 'string'},
                    'default': DEFAULT_BACKUP_LOCATIONS
                }
            }
        },
        'resolve': {
            'type': 'dict',
            'schema': {
                'auto_launch': {'type': 'boolean', 'default': True},
                'project_template': {'type': 'string', 'default': 'default'}
            }
        },
        'lut': {
            'type': 'dict',
            'schema': {
                'library_path': {'type': 'string', 'default': ''},
                'auto_apply': {'type': 'boolean', 'default': True}
            }
        },
        'proxy': {
            'type': 'dict',
            'schema': {
                'enabled': {'type': 'boolean', 'default': True},
                'resolution_threshold': {
                    'type': 'list',
                    'schema': {'type': 'integer'},
                    'minlength': 2,
                    'maxlength': 2,
                    'default': list(DEFAULT_PROXY_RESOLUTION_THRESHOLD)
                },
                'codec': {'type': 'string', 'default': DEFAULT_PROXY_CODEC}
            }
        },
        'report': {
            'type': 'dict',
            'schema': {
                'template': {'type': 'string', 'default': 'default'},
                'auto_open': {'type': 'boolean', 'default': True}
            }
        },
        'ipc': {
            'type': 'dict',
            'schema': {
                'host': {'type': 'string', 'default': DEFAULT_IPC_HOST},
                'port': {'type': 'integer', 'default': DEFAULT_IPC_PORT}
            }
        }
    }
    
    def __init__(self, config_path: Optional[str] = None):
        """初始化配置管理器。
        
        Args:
            config_path: 配置文件路径，如果为None则使用默认路径
        """
        self.config_path = Path(config_path) if config_path else DEFAULT_CONFIG_FILE
        self.logger = get_logger("config")
        self.validator = Validator(self.CONFIG_SCHEMA)
        self._config: Optional[Dict[str, Any]] = None
    
    def load_config(self) -> Dict[str, Any]:
        """加载配置文件。
        
        Returns:
            配置字典
            
        Raises:
            ConfigError: 配置加载或验证失败时抛出
        """
        try:
            # 如果配置文件不存在，创建默认配置
            if not self.config_path.exists():
                self.logger.info(f"配置文件不存在，创建默认配置: {self.config_path}")
                self._create_default_config()
            
            # 加载配置文件
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f) or {}
            
            # 验证配置
            if not self.validator.validate(config_data):
                self.logger.warning(f"配置验证失败: {self.validator.errors}")
                # 使用默认值填充无效配置
                config_data = self._apply_defaults(config_data)
            
            # 应用默认值
            config_data = self.validator.normalized(config_data)
            
            self._config = config_data
            self.logger.info("配置加载成功")
            return config_data
            
        except yaml.YAMLError as e:
            self.logger.error(f"YAML解析错误: {e}")
            return self._get_default_config()
        except Exception as e:
            self.logger.error(f"配置加载失败: {e}")
            return self._get_default_config()
    
    def save_config(self, config: Dict[str, Any]) -> bool:
        """保存配置到文件。
        
        Args:
            config: 要保存的配置字典
            
        Returns:
            是否保存成功
        """
        try:
            # 验证配置
            if not self.validator.validate(config):
                self.logger.error(f"配置验证失败: {self.validator.errors}")
                return False
            
            # 确保配置目录存在
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 保存配置
            with open(self.config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
            
            self._config = config
            self.logger.info("配置保存成功")
            return True
            
        except Exception as e:
            self.logger.error(f"配置保存失败: {e}")
            return False
    
    def get_config(self) -> Dict[str, Any]:
        """获取当前配置。
        
        Returns:
            当前配置字典
        """
        if self._config is None:
            return self.load_config()
        return self._config
    
    def update_config(self, updates: Dict[str, Any]) -> bool:
        """更新配置。
        
        Args:
            updates: 要更新的配置项
            
        Returns:
            是否更新成功
        """
        current_config = self.get_config()
        
        # 深度合并配置
        updated_config = self._deep_merge(current_config, updates)
        
        return self.save_config(updated_config)
    
    def _create_default_config(self):
        """创建默认配置文件。"""
        default_config = self._get_default_config()
        
        # 确保配置目录存在
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.config_path, 'w', encoding='utf-8') as f:
            yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
    
    def _get_default_config(self) -> Dict[str, Any]:
        """获取默认配置。
        
        Returns:
            默认配置字典
        """
        return {
            'application': {
                'language': DEFAULT_LANGUAGE,
                'log_level': DEFAULT_LOG_LEVEL
            },
            'workflow': {
                'backup_locations': DEFAULT_BACKUP_LOCATIONS
            },
            'resolve': {
                'auto_launch': True,
                'project_template': 'default'
            },
            'lut': {
                'library_path': '',
                'auto_apply': True
            },
            'proxy': {
                'enabled': True,
                'resolution_threshold': list(DEFAULT_PROXY_RESOLUTION_THRESHOLD),
                'codec': DEFAULT_PROXY_CODEC
            },
            'report': {
                'template': 'default',
                'auto_open': True
            },
            'ipc': {
                'host': DEFAULT_IPC_HOST,
                'port': DEFAULT_IPC_PORT
            }
        }
    
    def _apply_defaults(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """应用默认值到配置。
        
        Args:
            config: 原始配置
            
        Returns:
            应用默认值后的配置
        """
        default_config = self._get_default_config()
        return self._deep_merge(default_config, config)
    
    def _deep_merge(self, base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        """深度合并两个字典。
        
        Args:
            base: 基础字典
            updates: 更新字典
            
        Returns:
            合并后的字典
        """
        result = base.copy()
        
        for key, value in updates.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        
        return result


class ConfigError(Exception):
    """配置相关错误。"""
    pass