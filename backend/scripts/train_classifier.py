import os
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset

# Define the taxonomy (must match risk_classifier.py)
LABELS = [
    "auto_renewal", "liability", "arbitration", "data_sharing",
    "termination", "penalty", "indemnification", "intellectual_property",
    "confidentiality", "non_compete", "payment_terms", "force_majeure", "none"
]
LABEL_TO_ID = {label: i for i, label in enumerate(LABELS)}
ID_TO_LABEL = {i: label for i, label in enumerate(LABELS)}

def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average="macro", zero_division=0)
    acc = accuracy_score(labels, preds)
    return {
        "accuracy": acc,
        "f1": f1,
        "precision": precision,
        "recall": recall
    }

def main():
    data_path = os.path.join("data", "training.csv")
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found. Please run prepare_dataset.py first.")
        return

    print("Loading data...")
    df = pd.read_csv(data_path)
    
    # Drop NaNs
    df = df.dropna(subset=["text", "category"])
    
    # Map labels to integers
    df["label"] = df["category"].map(LABEL_TO_ID)
    
    # Split 80/20
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df["label"])
    
    print(f"Training set: {len(train_df)} examples")
    print(f"Validation set: {len(test_df)} examples")

    # Convert to Hugging Face Dataset
    train_dataset = Dataset.from_pandas(train_df)
    test_dataset = Dataset.from_pandas(test_df)

    model_name = "distilbert-base-uncased"
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    def tokenize_function(examples):
        return tokenizer(examples["text"], padding="max_length", truncation=True, max_length=512)

    print("Tokenizing datasets...")
    train_dataset = train_dataset.map(tokenize_function, batched=True)
    test_dataset = test_dataset.map(tokenize_function, batched=True)

    # Initialize model
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name, 
        num_labels=len(LABELS),
        id2label=ID_TO_LABEL,
        label2id=LABEL_TO_ID
    )

    training_args = TrainingArguments(
        output_dir="./distilbert-clauseguard-checkpoints",
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        num_train_epochs=3,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        logging_dir="./logs",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=test_dataset,
        compute_metrics=compute_metrics,
    )

    print("Starting training...")
    trainer.train()

    print("\nEvaluating on test set...")
    metrics = trainer.evaluate()
    
    print("\n--- Final Metrics ---")
    print(f"Accuracy : {metrics['eval_accuracy']:.4f}")
    print(f"Precision: {metrics['eval_precision']:.4f}")
    print(f"Recall   : {metrics['eval_recall']:.4f}")
    print(f"F1 Score : {metrics['eval_f1']:.4f}")

    save_path = os.path.join(os.path.dirname(__file__), "..", "models", "clause_classifier")
    os.makedirs(save_path, exist_ok=True)
    print(f"\nSaving fine-tuned model and tokenizer to {save_path}...")
    trainer.save_model(save_path)
    tokenizer.save_pretrained(save_path)
    print("Done!")

if __name__ == "__main__":
    main()
