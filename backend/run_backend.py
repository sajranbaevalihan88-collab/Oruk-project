import os

import uvicorn

if __name__ == "__main__":
    # Render/Heroku-style hosting provides PORT; local default stays 8020
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8020)), reload=False)
