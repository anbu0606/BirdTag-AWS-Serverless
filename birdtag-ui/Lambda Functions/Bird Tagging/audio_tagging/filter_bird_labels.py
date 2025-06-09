def filter_bird_labels(input_file, output_file):
    """
    Filter out non-bird species from the BirdNET labels file.
    
    Parameters:
    input_file (str): Path to the original BirdNET labels file
    output_file (str): Path where the filtered bird-only file will be saved
    """
    # Define keywords for non-bird entries to filter out
    non_bird_keywords = [
        # Amphibians
        'Acris', 'Anaxyrus', 'Eleutherodactylus', 'Hyliola', 'Lithobates', 
        'Pseudacris', 'Scaphiopus', 'Spea',
        
        # Insects
        'Allonemobius', 'Amblycorypha', 'Anaxipha', 'Atlanticus', 'Cyrtoxipha',
        'Eunemobius', 'Gryllus', 'Microcentrum', 'Miogryllus', 'Neoconocephalus', 
        'Neonemobius', 'Oecanthus', 'Orchelimum', 'Orocharis', 'Phyllopalpus', 
        'Pterophylla', 'Scudderia', 'Conocephalus', 'Apis mellifera',
        
        # Mammals
        'Alouatta pigra', 'Canis', 'Odocoileus', 'Sciurus', 'Tamiasciurus', 'Tamias',
        
        # Other non-animal sounds
        'Dog_Dog', 'Engine_Engine', 'Environmental_Environmental', 'Fireworks_Fireworks', 
        'Gun_Gun', 'Human non-vocal', 'Human vocal', 'Human whistle', 
        'Noise_Noise', 'Power tools', 'Siren_Siren'
    ]
    
    # Read the original file
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Filter out non-bird species
    bird_lines = []
    for line in lines:
        # Check if the line contains any non-bird keywords
        if not any(keyword in line for keyword in non_bird_keywords):
            bird_lines.append(line)
    
    # Write the filtered content to the output file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(bird_lines)
    
    # Print summary
    print(f"Original file had {len(lines)} entries")
    print(f"Bird-only file has {len(bird_lines)} entries")
    print(f"Removed {len(lines) - len(bird_lines)} non-bird entries")
    print(f"Saved bird-only labels to {output_file}")

# Example usage
if __name__ == "__main__":
    input_file = "BirdNET_GLOBAL_6K_V2.4_Labels.txt"  # Replace with your input file path
    output_file = "BirdNET_GLOBAL_6K_V2.4_Labels_Birds_Only.txt"  # Replace with your desired output file path
    
    filter_bird_labels(input_file, output_file)