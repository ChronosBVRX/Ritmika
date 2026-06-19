from PIL import Image
import sys

def remove_green(image_path, output_path):
    try:
        img = Image.open(image_path).convert("RGBA")
        datas = img.getdata()
        newData = []
        
        for item in datas:
            # Check if pixel is pure green or close to it
            if item[1] > 200 and item[0] < 100 and item[2] < 100:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Success: {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_green(sys.argv[1], sys.argv[2])
