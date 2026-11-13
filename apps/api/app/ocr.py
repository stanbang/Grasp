import json
import subprocess
import shutil
import tempfile
from pathlib import Path
from .parsing import DocumentInputError


def ocr_page(path: Path, page: int, language: str='eng') -> str:
    renderer=shutil.which('pdftoppm');tesseract=shutil.which('tesseract')
    if not renderer or not tesseract:
        raise DocumentInputError('This scanned PDF needs local OCR. Install Poppler and Tesseract, or use the OCR-enabled container.')
    if not language.replace('+','').replace('_','').isalnum():
        raise DocumentInputError('OCR_LANGUAGE must contain language codes such as eng or eng+chi_sim.')
    with tempfile.TemporaryDirectory(prefix='grasp-ocr-') as folder:
        prefix=Path(folder)/'page'
        try:
            subprocess.run([renderer,'-f',str(page),'-l',str(page),'-r','150','-scale-to','2200','-singlefile','-png',str(path),str(prefix)],check=True,capture_output=True,timeout=60)
            result=subprocess.run([tesseract,str(prefix.with_suffix('.png')),'stdout','-l',language,'--psm','3'],check=True,capture_output=True,timeout=60)
        except subprocess.TimeoutExpired as error:raise DocumentInputError('OCR timed out on a page. Use a smaller or clearer scan.') from error
        except subprocess.CalledProcessError as error:raise DocumentInputError('OCR could not read this page. Check the installed OCR language or export a clearer scan.') from error
        return result.stdout.decode('utf-8').strip()
