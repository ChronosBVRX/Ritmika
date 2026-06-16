import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# 1. Update CSS for .podium-pedestal and steps
old_pedestal_css = """    .podium-pedestal {
      width: 100%;
      border-top-left-radius: 1.5rem;
      border-top-right-radius: 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border-top: 4px solid;
    }
    
    /* 1st Place Pedestal */
    .step-1st {
      height: 180px;
      background: linear-gradient(to top, #78350f, #eab308);
      border-color: #facc15;
      box-shadow: 0 0 30px rgba(250, 204, 21, 0.3);
    }
    .step-1st::after {
      content: '1';
      font-size: 5rem;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.15);
      position: absolute;
      bottom: 10px;
      line-height: 1;
    }

    /* 2nd Place Pedestal */
    .step-2nd {
      height: 130px;
      background: linear-gradient(to top, #164e63, #06b6d4);
      border-color: #22d3ee;
      box-shadow: 0 0 25px rgba(34, 211, 238, 0.25);
    }
    .step-2nd::after {
      content: '2';
      font-size: 4rem;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.15);
      position: absolute;
      bottom: 10px;
      line-height: 1;
    }

    /* 3rd Place Pedestal */
    .step-3rd {
      height: 90px;
      background: linear-gradient(to top, #7c2d12, #f97316);
      border-color: #ffedd5;
      box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
    }
    .step-3rd::after {
      content: '3';
      font-size: 3rem;
      font-weight: 900;
      color: rgba(255, 255, 255, 0.15);
      position: absolute;
      bottom: 10px;
      line-height: 1;
    }"""

new_pedestal_css = """    .podium-pedestal {
      width: 100%;
      border-top-left-radius: 16px;
      border-top-right-radius: 16px;
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      border: 4px solid #111827;
      box-shadow: 8px 8px 0px #111827;
    }
    
    /* 1st Place Pedestal */
    .step-1st {
      height: 180px;
      background-color: #facc15;
      box-shadow: inset 0 0 30px rgba(255,255,255,0.6), 0 0 30px rgba(250, 204, 21, 0.4), 8px 8px 0px #111827;
    }
    .step-1st::after {
      content: '1';
      font-size: 5rem;
      font-weight: 900;
      color: rgba(17, 24, 39, 0.2);
      position: absolute;
      bottom: 10px;
      line-height: 1;
    }

    /* 2nd Place Pedestal */
    .step-2nd {
      height: 130px;
      background-color: #00e5ff;
      box-shadow: inset 0 0 30px rgba(255,255,255,0.6), 0 0 25px rgba(0, 229, 255, 0.4), 8px 8px 0px #111827;
    }
    .step-2nd::after {
      content: '2';
      font-size: 4rem;
      font-weight: 900;
      color: rgba(17, 24, 39, 0.2);
      position: absolute;
      bottom: 10px;
      line-height: 1;
    }

    /* 3rd Place Pedestal */
    .step-3rd {
      height: 90px;
      background-color: #ff6b00;
      box-shadow: inset 0 0 30px rgba(255,255,255,0.6), 0 0 20px rgba(255, 107, 0, 0.4), 8px 8px 0px #111827;
    }
    .step-3rd::after {
      content: '3';
      font-size: 3rem;
      font-weight: 900;
      color: rgba(17, 24, 39, 0.2);
      position: absolute;
      bottom: 10px;
      line-height: 1;
    }"""

content = content.replace(old_pedestal_css, new_pedestal_css)

# 2. Update CSS for .podium-rank-badge and badges
old_badge_css = """    .podium-rank-badge {
      font-size: 0.8rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.2rem 0.75rem;
      border-radius: 999px;
      margin-bottom: 0.5rem;
      border: 1px solid;
    }

    .badge-1st {
      background-color: rgba(250, 204, 21, 0.2);
      border-color: #facc15;
      color: #facc15;
      text-shadow: 0 0 10px rgba(250, 204, 21, 0.5);
    }
    .badge-2nd {
      background-color: rgba(34, 211, 238, 0.2);
      border-color: #22d3ee;
      color: #22d3ee;
      text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
    }
    .badge-3rd {
      background-color: rgba(249, 115, 22, 0.2);
      border-color: #f97316;
      color: #f97316;
      text-shadow: 0 0 10px rgba(249, 115, 22, 0.5);
    }"""

new_badge_css = """    .podium-rank-badge {
      font-size: 0.8rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 0.2rem 0.75rem;
      border-radius: 999px;
      margin-bottom: 0.5rem;
      border: 3px solid #111827;
      box-shadow: 3px 3px 0px #111827;
      color: #111827;
      text-shadow: none;
    }

    .badge-1st {
      background-color: #facc15;
    }
    .badge-2nd {
      background-color: #00e5ff;
    }
    .badge-3rd {
      background-color: #ff6b00;
    }"""

content = content.replace(old_badge_css, new_badge_css)

with codecs.open('public/tv.html', 'w', 'utf-8') as f:
    f.write(content)

print("CSS podium elements replaced.")
