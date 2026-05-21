import re

def convert_to_react():
    with open(r"c:\Users\Sam\Downloads\index.html", "r", encoding="utf-8") as f:
        content = f.read()

    # Extract CSS
    style_match = re.search(r'<style>(.*?)</style>', content, re.DOTALL)
    if style_match:
        with open(r"C:\Users\Sam\.gemini\antigravity\scratch\elite-pool-react\src\index.css", "w", encoding="utf-8") as f:
            f.write(style_match.group(1).strip())

    # Extract Body
    body_match = re.search(r'<body>(.*?)<script>', content, re.DOTALL)
    body_html = body_match.group(1).strip() if body_match else ""

    # Extract JS
    script_match = re.search(r'<script>(.*?)</script>', content, re.DOTALL)
    script_js = script_match.group(1).strip() if script_match else ""

    # Simple JSX conversion for body
    body_jsx = body_html.replace('class=', 'className=')
    body_jsx = body_jsx.replace('onclick=', 'onClick=')
    body_jsx = body_jsx.replace('onchange=', 'onChange=')
    body_jsx = body_jsx.replace('oninput=', 'onInput=')
    body_jsx = body_jsx.replace('for=', 'htmlFor=')
    body_jsx = body_jsx.replace('charset=', 'charSet=')

    def style_to_jsx(match):
        style_str = match.group(1)
        props = []
        for part in style_str.split(';'):
            if ':' in part:
                k, v = part.split(':', 1)
                k = k.strip()
                k = re.sub(r'-([a-z])', lambda m: m.group(1).upper(), k)
                v = v.strip().replace('"', "'")
                props.append(f'{k}: "{v}"')
        return 'style={{' + ', '.join(props) + '}}'

    body_jsx = re.sub(r'style="([^"]*)"', style_to_jsx, body_jsx)

    # We also need to close inputs
    body_jsx = re.sub(r'<input([^>]*?[^/])>', r'<input\1 />', body_jsx)
    body_jsx = re.sub(r'<br([^>]*?[^/])>', r'<br\1 />', body_jsx)
    # Self-closing <br> without attributes
    body_jsx = body_jsx.replace('<br>', '<br />')
    
    # Remove comments just in case they are not JSX compliant
    body_jsx = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', body_jsx, flags=re.DOTALL)

    # Fix some raw JS in onClick to string or remove them if too complex.
    # Actually, in a true React app we shouldn't use raw strings in onClick.
    # For now, we'll replace onClick="fn()" with onClick={() => fn()}
    def onclick_to_jsx(match):
        return f'onClick={{() => {match.group(1)}}}'
    body_jsx = re.sub(r'onClick="([^"]*)"', onclick_to_jsx, body_jsx)
    
    def onchange_to_jsx(match):
        # some functions pass this.value, we need to pass event.target.value
        call = match.group(1).replace('this.value', 'e.target.value')
        return f'onChange={{(e) => {call}}}'
    body_jsx = re.sub(r'onChange="([^"]*)"', onchange_to_jsx, body_jsx)

    def oninput_to_jsx(match):
        call = match.group(1).replace('this.value', 'e.target.value')
        return f'onInput={{(e) => {call}}}'
    body_jsx = re.sub(r'onInput="([^"]*)"', oninput_to_jsx, body_jsx)

    # Some variables like `CUR` and functions need to be attached to window if we are moving them to module scope and calling them from inline arrow functions, OR we just put the JS in the same scope.
    # To make the Quick Port work, we can just put the JS outside the App component.

    app_jsx = f"""import React, {{ useEffect }} from 'react';
import './index.css';

{script_js}

export default function App() {{
  useEffect(() => {{
    // Initialization logic if needed
    if (typeof window !== 'undefined' && window.renderAll) window.renderAll();
  }}, []);

  return (
    <>
      {body_jsx}
    </>
  );
}}
"""

    # We need to make the functions global so the inline handlers can reach them if they are evaluated as `() => functionName()` because they are in the module scope and React handles it correctly actually! Wait, if it's `onClick={() => doLogin()}` it will refer to the module-scoped `doLogin`. So it's fine!
    
    with open(r"C:\Users\Sam\.gemini\antigravity\scratch\elite-pool-react\src\App.jsx", "w", encoding="utf-8") as f:
        f.write(app_jsx)

if __name__ == "__main__":
    convert_to_react()
