# import logging
# from pathlib import Path
# from typing import Union
# import gzip

# def merge_tsv_files(tsv_path: Union[str, Path], output_filename: str = "merged.tsv") -> None:
#     """
#     Merge all .tsv files in a directory into a single .tsv file (uncompressed).

#     Args:
#         tsv_path (Union[str, Path]): Path to the directory containing .tsv files.
#         output_filename (str): Name of the output .tsv file.
#     """
#     tsv_path = Path(tsv_path)
#     output_path = tsv_path / output_filename

#     logging.info(f"Merging TSV files from: {tsv_path}")
#     tsv_files = sorted(tsv_path.glob("*.tsv"))

#     if not tsv_files:
#         logging.warning("No TSV files found.")
#         return

#     with open(output_path, 'w', encoding='utf-8') as out_file:
#         header_written = False
#         for tsv_file in tsv_files:
#             logging.info(f"Processing: {tsv_file.name}")
#             with open(tsv_file, 'r', encoding='utf-8') as f:
#                 lines = f.readlines()
#                 if not lines:
#                     continue
#                 if not header_written:
#                     out_file.write(lines[0])  # Write header from first file
#                     header_written = True
#                 out_file.writelines(lines[1:])  # Skip header for the rest

#     logging.info(f"Merged TSV written to {output_path}")

# def merge_jsonl_files(
#     jsonl_path : Union[str, Path],
#     split : str,
#     output_filename: str = "merged.jsonl.gz"
# ) -> None:
#     jsonl_path = Path(jsonl_path)
#     output_path = jsonl_path / output_filename
#     logging.info(f"Merging JSONL files from: {jsonl_path}")
#     jsonl_files = sorted(jsonl_path.glob("*.jsonl.gz"))
#     if not jsonl_files:
#         logging.warning("No JSONL files found.")
#         return
    
#     with gzip.open(output_path, 'w') as out_file:
#         for jsonl_file in jsonl_files:
#             logging.info(f"Processing: {jsonl_file.name}")
#             with gzip.open(jsonl_file, 'r') as f:
#                 out_file.write(f.read())
                
#     logging.info(f"Merged JSONL written to {output_path}")

# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser(description="Merge .tsv files into a single .tsv file")
#     parser.add_argument("tsv_path", type=str, help="Path to folder containing .tsv files")
#     args = parser.parse_args()
#     logging.basicConfig(level=logging.INFO)
#     merge_tsv_files(args.tsv_path)


import os
import glob
import argparse

def merge_jsonl_files(input_directory, output_file):
    """
    Merges all .jsonl files in a directory into a single .jsonl file.

    Args:
        input_directory (str): The path to the directory containing the .jsonl files.
        output_file (str): The path for the merged output .jsonl file.
    """
    # Find all JSONL files in the input directory using a pattern that matches your files
    # The pattern looks for files ending in .jsonl
    file_pattern = os.path.join(input_directory, '*.jsonl')
    jsonl_files = sorted(glob.glob(file_pattern)) # Sorting ensures a consistent order

    if not jsonl_files:
        print(f"No .jsonl files found in the directory: {input_directory}")
        return

    print(f"Found {len(jsonl_files)} .jsonl files to merge.")

    try:
        # Open the output file in write mode
        with open(output_file, 'w', encoding='utf-8') as outfile:
            # Iterate through each input file
            for i, filename in enumerate(jsonl_files):
                print(f"Processing file {i+1}/{len(jsonl_files)}: {os.path.basename(filename)}")
                with open(filename, 'r', encoding='utf-8') as infile:
                    # Read each line from the input file and write it to the output file
                    for line in infile:
                        outfile.write(line)
        
        print(f"\nSuccessfully merged all files into: {output_file}")

    except IOError as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    # Set up argument parser to get directory and output file from the command line
    parser = argparse.ArgumentParser(
        description="Merge all .jsonl files in a directory into a single file.",
        epilog="Example: python merge_jsonl.py /path/to/your/files merged_output.jsonl"
    )
    parser.add_argument('input_dir', type=str, help='The input directory containing the .jsonl files.')
    parser.add_argument('output_file', type=str, help='The name of the merged output .jsonl file.')

    args = parser.parse_args()

    # Call the merge function with the provided arguments
    merge_jsonl_files(args.input_dir, args.output_file)
