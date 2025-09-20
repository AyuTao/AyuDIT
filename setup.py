"""AyuDIT安装脚本。"""

from setuptools import setup, find_packages
from pathlib import Path

# 读取README文件
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text(encoding="utf-8") if readme_file.exists() else ""

# 读取requirements文件
requirements_file = Path(__file__).parent / "requirements.txt"
requirements = []
if requirements_file.exists():
    with open(requirements_file, 'r', encoding='utf-8') as f:
        requirements = [
            line.strip() 
            for line in f 
            if line.strip() and not line.startswith('#')
        ]

setup(
    name="ayudit",
    version="1.0.0",
    author="AyuDIT Team",
    author_email="team@ayudit.com",
    description="DaVinci Resolve Workflow Automation System",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/ayudit/ayudit",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Multimedia :: Video",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=22.0.0",
            "isort>=5.10.0",
            "flake8>=4.0.0",
            "mypy>=0.950",
        ],
        "media": [
            "ffmpeg-python>=0.2.0",
            "librosa>=0.9.0",
            "opencv-python>=4.5.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "ayudit=ayu_dit.main:main",
        ],
    },
    include_package_data=True,
    package_data={
        "ayu_dit": [
            "resources/*",
            "templates/*",
        ],
    },
)