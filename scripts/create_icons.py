from PIL import Image, ImageDraw, ImageFont
import os

# Icon sizes needed for Expo
ICON_SIZE = 1024
ADAPTIVE_ICON_SIZE = 1024

# Colors from the app
BACKGROUND = '#1a1a2e'
CARD_BG = '#16213e'
PRIMARY = '#e94560'
NORMAL = '#4ecdc4'
WHITE = '#eaeaea'

def create_main_icon():
    """Create the main app icon"""
    img = Image.new('RGBA', (ICON_SIZE, ICON_SIZE), BACKGROUND)
    draw = ImageDraw.Draw(img)
    
    # Draw a rounded rectangle background
    margin = 80
    rect_bounds = [margin, margin, ICON_SIZE - margin, ICON_SIZE - margin]
    draw.rounded_rectangle(rect_bounds, radius=120, fill=CARD_BG)
    
    # Draw checklist items
    start_y = 250
    item_height = 180
    checkbox_size = 80
    line_start_x = 350
    line_end_x = 850
    
    for i in range(3):
        y = start_y + i * item_height
        checkbox_x = 200
        checkbox_y = y
        
        # Draw checkbox circle
        if i == 0:
            # First item - completed (filled with checkmark)
            draw.ellipse(
                [checkbox_x, checkbox_y, checkbox_x + checkbox_size, checkbox_y + checkbox_size],
                fill=NORMAL,
                outline=NORMAL,
                width=4
            )
            # Draw checkmark
            check_points = [
                (checkbox_x + 20, checkbox_y + 45),
                (checkbox_x + 35, checkbox_y + 60),
                (checkbox_x + 65, checkbox_y + 25)
            ]
            draw.line(check_points, fill=WHITE, width=10)
        elif i == 1:
            # Second item - urgent priority (red outline)
            draw.ellipse(
                [checkbox_x, checkbox_y, checkbox_x + checkbox_size, checkbox_y + checkbox_size],
                outline=PRIMARY,
                width=6
            )
        else:
            # Third item - normal (turquoise outline)
            draw.ellipse(
                [checkbox_x, checkbox_y, checkbox_x + checkbox_size, checkbox_y + checkbox_size],
                outline=NORMAL,
                width=6
            )
        
        # Draw line representing task text
        line_y = y + checkbox_size // 2
        line_color = '#6c757d' if i == 0 else WHITE
        line_width = 750 - i * 100  # Varying lengths
        draw.rounded_rectangle(
            [line_start_x, line_y - 12, line_start_x + line_width, line_y + 12],
            radius=12,
            fill=line_color
        )
    
    # Draw a microphone icon at bottom right to represent voice feature
    mic_x = 750
    mic_y = 780
    mic_width = 60
    mic_height = 100
    
    # Microphone body
    draw.rounded_rectangle(
        [mic_x, mic_y, mic_x + mic_width, mic_y + mic_height],
        radius=30,
        fill=PRIMARY
    )
    
    # Microphone stand arc
    draw.arc(
        [mic_x - 25, mic_y + 40, mic_x + mic_width + 25, mic_y + mic_height + 50],
        start=0, end=180,
        fill=PRIMARY,
        width=8
    )
    
    # Microphone stand line
    draw.line(
        [(mic_x + mic_width // 2, mic_y + mic_height + 50), (mic_x + mic_width // 2, mic_y + mic_height + 80)],
        fill=PRIMARY,
        width=8
    )
    
    return img

def create_adaptive_icon():
    """Create adaptive icon for Android (foreground only, transparent bg)"""
    img = Image.new('RGBA', (ADAPTIVE_ICON_SIZE, ADAPTIVE_ICON_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Center offset for adaptive icon safe zone
    offset = 100
    
    # Draw checklist items centered
    start_y = 280 + offset
    item_height = 160
    checkbox_size = 70
    
    for i in range(3):
        y = start_y + i * item_height
        checkbox_x = 250
        checkbox_y = y
        
        if i == 0:
            draw.ellipse(
                [checkbox_x, checkbox_y, checkbox_x + checkbox_size, checkbox_y + checkbox_size],
                fill=NORMAL,
                outline=NORMAL,
                width=4
            )
            # Checkmark
            check_points = [
                (checkbox_x + 18, checkbox_y + 38),
                (checkbox_x + 30, checkbox_y + 52),
                (checkbox_x + 55, checkbox_y + 22)
            ]
            draw.line(check_points, fill=WHITE, width=8)
        elif i == 1:
            draw.ellipse(
                [checkbox_x, checkbox_y, checkbox_x + checkbox_size, checkbox_y + checkbox_size],
                outline=PRIMARY,
                width=5
            )
        else:
            draw.ellipse(
                [checkbox_x, checkbox_y, checkbox_x + checkbox_size, checkbox_y + checkbox_size],
                outline=NORMAL,
                width=5
            )
        
        # Task line
        line_y = y + checkbox_size // 2
        line_color = '#6c757d' if i == 0 else WHITE
        line_width = 500 - i * 80
        draw.rounded_rectangle(
            [checkbox_x + checkbox_size + 40, line_y - 10, checkbox_x + checkbox_size + 40 + line_width, line_y + 10],
            radius=10,
            fill=line_color
        )
    
    return img

def create_splash_icon():
    """Create splash screen icon"""
    img = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Simple checklist icon for splash
    checkbox_size = 50
    start_y = 100
    item_height = 100
    
    for i in range(3):
        y = start_y + i * item_height
        checkbox_x = 80
        
        if i == 0:
            draw.ellipse(
                [checkbox_x, y, checkbox_x + checkbox_size, y + checkbox_size],
                fill=NORMAL
            )
        elif i == 1:
            draw.ellipse(
                [checkbox_x, y, checkbox_x + checkbox_size, y + checkbox_size],
                outline=PRIMARY,
                width=4
            )
        else:
            draw.ellipse(
                [checkbox_x, y, checkbox_x + checkbox_size, y + checkbox_size],
                outline=NORMAL,
                width=4
            )
        
        # Line
        line_y = y + checkbox_size // 2
        draw.rounded_rectangle(
            [checkbox_x + checkbox_size + 25, line_y - 8, 320, line_y + 8],
            radius=8,
            fill=WHITE if i != 0 else '#6c757d'
        )
    
    return img

# Create icons
print("Creating main icon...")
main_icon = create_main_icon()
main_icon.save('/app/frontend/assets/images/icon.png', 'PNG')
print("✓ Main icon saved")

print("Creating adaptive icon...")
adaptive_icon = create_adaptive_icon()
adaptive_icon.save('/app/frontend/assets/images/adaptive-icon.png', 'PNG')
print("✓ Adaptive icon saved")

print("Creating splash icon...")
splash_icon = create_splash_icon()
splash_icon.save('/app/frontend/assets/images/splash-icon.png', 'PNG')
print("✓ Splash icon saved")

print("\n✅ All icons created successfully!")
