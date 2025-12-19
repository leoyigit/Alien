
try:
    import openai
    print(f"OpenAI version: {openai.__version__}")
    try:
        client = openai.OpenAI(api_key="test")
        print("OpenAI.OpenAI class exists.")
    except AttributeError:
        print("OpenAI.OpenAI class DOES NOT exist.")
    except Exception as e:
        print(f"Other error instantiating client: {e}")
except ImportError:
    print("OpenAI package NOT installed.")
except Exception as e:
    print(f"Error importing openai: {e}")
