from fastapi import FastAPI

app = FastAPI(title="EcoCharge AI Service")

@app.get("/health")
def health():
    return {"status": "ok", "service": "EcoCharge FastAPI"}